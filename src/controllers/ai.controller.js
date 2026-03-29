const { randomUUID } = require('crypto');
const { AIService, AILogsService, AgentMemoryService, TicketsFromAIService, InventoryService } = require('../services');
const Workspaces = require('../models/workspaces.model');
const WorkspacesUsuarios = require('../models/workspaces_usuarios.model');
const Tickets = require('../models/tickets.model');

class AIController {
    async createTicketDraft(req, res) {
        try {
            const userId = req.jwt?.sub;
            const { text, workspace_id: requestedWorkspaceId } = req.body;

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({ message: 'El campo text es requerido' });
            }

            const workspaceId = await this.resolveWorkspaceId(userId, requestedWorkspaceId);
            const draft = await AIService.createTicketDraft({
                text: text.trim(),
                userId,
                workspaceId
            });

            return res.status(200).json(draft);
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }

    async resolveWorkspaceId(userId, requestedWorkspaceId) {
        if (requestedWorkspaceId) {
            const membership = await WorkspacesUsuarios.findOne({
                workspace_id: requestedWorkspaceId,
                usuario_id: userId
            });

            if (membership) {
                return requestedWorkspaceId;
            }

            const adminWorkspace = await Workspaces.findOne({
                _id: requestedWorkspaceId,
                admin_id: userId,
                is_deleted: false
            });

            if (adminWorkspace) {
                return requestedWorkspaceId;
            }

            const error = new Error('El usuario no pertenece al workspace indicado');
            error.status = 403;
            throw error;
        }

        const membership = await WorkspacesUsuarios.findOne({ usuario_id: userId }).sort({ createdAt: 1 });

        if (membership?.workspace_id) {
            return membership.workspace_id.toString();
        }

        const adminWorkspace = await Workspaces.findOne({ admin_id: userId, is_deleted: false }).sort({ created_at: 1 });

        if (adminWorkspace?._id) {
            return adminWorkspace._id.toString();
        }

        const error = new Error('No se encontro un workspace para el usuario autenticado');
        error.status = 404;
        throw error;
    }

    isCreateTicketIntent(text) {
        const normalized = text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const patterns = [
            /crea(?:r)?\s+(?:un\s+)?ticket/,
            /crea(?:me)?(?:\s+el)?\s+ticket/,
            /crea(?:lo|la|los|las)/,
            /cr.a(?:lo|la|los|las)/,
            /ahora\s+crea(?:lo|la|los|las)?/,
            /registra(?:r)?\s+(?:este\s+)?problema/,
            /guarda(?:r)?\s+(?:este\s+)?ticket/
        ];
        return patterns.some((pattern) => pattern.test(normalized));
    }

    normalizeText(text) {
        if (typeof text !== 'string') {
            return '';
        }

        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isSensitiveRequest(normalizedText) {
        const patterns = [
            /\b(contras|password|credencial|credenciales|clave de acceso|token|secreto|secretos|api key|llave privada|private key|access token)\w*\b/,
            /\b(dame|pasame|comparte|muestrame|mostrar|revelame|revelar|entrega|entregar|decime|dime|necesito)\b.*\b(contras|password|credencial|credenciales|clave|token|secreto|secretos|api key|llave privada|private key)\w*\b/,
            /\b(cual es|cuales son|quiero|necesito)\b.*\b(credenciales|contras|password|token|secreto|api key)\w*\b/
        ];

        return patterns.some((pattern) => pattern.test(normalizedText));
    }

    hasAbusiveLanguage(normalizedText) {
        const abusivePatterns = [
            /\b(idiota|estupido|estupida|imbecil|pendejo|pendeja|cabron|cabrona|mierda|jodete|hijo de perra|puta|puto|maldito)\b/
        ];

        return abusivePatterns.some((pattern) => pattern.test(normalizedText));
    }

    isSupportScopeText(normalizedText) {
        if (!normalizedText) {
            return false;
        }

        const inventorySignals = /\b(inventario|articulo|articulos|almacen|almacenes|existencias?|stock|bajo stock|stock bajo|minimo|minimos|critico|critica|criticos|criticas)\b/;
        if (inventorySignals.test(normalizedText)) {
            return true;
        }

        const explicitSupportIntent = /\b(ticket|tickets|soporte|clasifica|clasificar|resumen|resume|sumario|sumariza|crear|crea|registra|guardar|guarda|incidencia)\b/;
        const supportSignals = /\b(error|falla|falla|problema|averia|averiado|no funciona|no puedo|sin acceso|acceso|permiso|permisos|correo|email|wifi|red|vpn|impresora|servidor|base de datos|celular|telefono|computadora|pc|laptop|monitor|pantalla|teclado|mouse|app|aplicacion|sistema|modulo|portal|cuenta|usuario|login)\b/;

        return explicitSupportIntent.test(normalizedText) || supportSignals.test(normalizedText);
    }

    isClearlyOutOfScope(normalizedText) {
        if (!normalizedText) {
            return false;
        }

        if (this.isSupportScopeText(normalizedText)) {
            return false;
        }

        const generalKnowledgePatterns = [
            /\b(capital de|quien gano|clima|tiempo|receta|chiste|pelicula|futbol|politica|traduce|traduccion|matematica|ecuacion|francia|mexico)\b/,
            /^(hola|buenas|buenos dias|como estas|que tal)$/
        ];

        return generalKnowledgePatterns.some((pattern) => pattern.test(normalizedText)) || normalizedText.split(' ').length <= 3;
    }

    evaluateRequestPolicy(text) {
        const normalized = this.normalizeText(text);

        if (this.isSensitiveRequest(normalized)) {
            return {
                intent: 'sensitive_request',
                reason: 'sensitive_request',
                message: 'No puedo proporcionar contraseñas, credenciales ni información sensible. Si necesitas acceso, puedo ayudarte a generar un ticket o indicarte el proceso adecuado.',
                guidance: 'Solicita acceso mediante el proceso autorizado o crea un ticket de soporte para que el equipo correspondiente lo gestione.'
            };
        }

        if (this.hasAbusiveLanguage(normalized)) {
            return {
                intent: 'abusive_request',
                reason: 'abusive_request',
                message: 'Puedo ayudarte con tickets, clasificación y resúmenes de soporte. Si deseas continuar, describe el problema de forma clara.',
                guidance: 'Describe el incidente técnico, el impacto y cualquier detalle relevante para que pueda ayudarte dentro del alcance de Panal.'
            };
        }

        if (this.isClearlyOutOfScope(normalized)) {
            return {
                intent: 'out_of_scope',
                reason: 'out_of_scope',
                message: 'Solo puedo ayudar con soporte técnico, tickets, clasificación y resúmenes dentro de Panal.',
                guidance: 'Si tienes un incidente o solicitud de soporte, descríbelo con contexto técnico para que pueda orientarte o preparar un ticket.'
            };
        }

        return null;
    }

    detectInventoryIntent(text) {
        const normalized = this.normalizeText(text);
        if (!normalized) {
            return null;
        }

        const rawLower = typeof text === 'string' ? text.toLowerCase() : '';
        const hasInventoryDomain = /\b(inventar|articul|almac|stock|existenc|minim|critic)\w*/.test(normalized)
            || /\b(inventar|articul|almac|stock|existenc|minim|critic)\w*/.test(rawLower);
        if (!hasInventoryDomain) {
            return null;
        }

        const alertsPatterns = [
            /\b(alerta|alertas|alertamiento|avisos?)\b/,
            /\b(inventario\s+en\s+alerta|alertas?\s+de\s+inventario)\b/
        ];

        if (alertsPatterns.some((pattern) => pattern.test(normalized))) {
            return 'inventory_alerts';
        }

        const lowStockPatterns = [
            /\b(bajo stock|stock bajo|stock minimo|minimo|critico|critica|criticos|criticas|quedan pocos|por debajo)\b/,
            /\b(inventario\s+critico|inventario\s+en\s+riesgo)\b/,
            /\barticulos?\s+(estan\s+)?bajos?\b/,
            /\b(muestrame|muestranos|dame|listar|lista)\b.*\b(bajo stock|stock bajo)\b/
        ];

        if (lowStockPatterns.some((pattern) => pattern.test(normalized))) {
            return 'inventory_low_stock';
        }

        const summaryPatterns = [
            /\b(resumen|resume|sumario|estado general|panorama|distribucion)\b/,
            /\b(por almacen|por almacenes|por almac)\b/,
            /\b(total|totales)\b/
        ];

        if (summaryPatterns.some((pattern) => pattern.test(normalized))) {
            return 'inventory_summary';
        }

        const listPatterns = [
            /\b(lista|listar|muestra|mostrar|ensena|dame|cuales|cual(es)? hay)\b/,
            /\barticulos?\s+hay\b/
        ];

        if (listPatterns.some((pattern) => pattern.test(normalized))) {
            return 'inventory_list';
        }

        // Default inventory intent when user asks about inventory without explicit action.
        return 'inventory_summary';
    }

    buildInventoryListMessage(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return 'No hay artículos registrados en este workspace.';
        }

        const lines = items.map((item) => `- ${item.nombre} — almacén: ${item.almacen_nombre}`);
        return `Estos son los artículos registrados:\n${lines.join('\n')}`;
    }

    buildInventorySummaryMessage(summary) {
        if (!summary) {
            return 'No fue posible construir el resumen de inventario.';
        }

        const distributionLines = (summary.articulos_por_almacen || [])
            .map((entry) => `- ${entry.almacen_nombre}: ${entry.total_articulos}`)
            .join('\n');

        return [
            `Actualmente hay ${summary.total_articulos} artículos registrados en ${summary.total_almacenes} almacenes.`,
            'Distribución:',
            distributionLines || '- Sin datos de distribución',
            `Activos: ${summary.articulos_activos} | Inactivos: ${summary.articulos_inactivos}.`,
            summary.integridad
        ].join('\n');
    }

    buildInventoryLowStockMessage(payload) {
        if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
            return 'No hay artículos en bajo stock actualmente.';
        }

        const lines = payload.items.map((item) => (
            `- ${item.nombre} (${item.stock_actual} / mínimo ${item.stock_minimo} ${item.unidad || 'unidad'})`
        ));

        return [
            `Hay ${payload.total_bajo_stock} artículos bajo stock:`,
            lines.join('\n')
        ].join('\n');
    }

    buildInventoryAlertsMessage(payload) {
        if (!payload || !Array.isArray(payload.articulos_alerta) || payload.articulos_alerta.length === 0) {
            return 'No hay alertas activas de inventario en este momento.';
        }

        const lines = payload.articulos_alerta.map((item) => {
            const criticalTag = item.critico ? ' [CRITICO]' : '';
            return `- ${item.nombre}${criticalTag} (${item.stock_actual} / mínimo ${item.stock_minimo} ${item.unidad || 'unidad'})`;
        });

        return [
            `Se detectaron ${payload.total_alertas} alertas de inventario (${payload.total_criticos} críticas):`,
            lines.join('\n')
        ].join('\n');
    }

    dedupeToolsInOrder(tools) {
        const seen = new Set();
        const ordered = [];

        (Array.isArray(tools) ? tools : []).forEach((tool) => {
            if (!tool || seen.has(tool)) {
                return;
            }

            seen.add(tool);
            ordered.push(tool);
        });

        return ordered;
    }

    buildToolPlanFromText(text, fallbackIntent) {
        const inventoryIntent = this.detectInventoryIntent(text);
        if (inventoryIntent === 'inventory_alerts') {
            return ['inventory_alerts'];
        }
        if (inventoryIntent === 'inventory_low_stock') {
            return ['inventory_low_stock'];
        }
        if (inventoryIntent === 'inventory_list') {
            return ['inventory_list'];
        }
        if (inventoryIntent === 'inventory_summary') {
            return ['inventory_summary'];
        }

        const normalized = this.normalizeText(text);
        const hasSummary = /\b(resume|resumen|sumariza|sumario|analiza)\b/.test(normalized);
        const hasUrgency = /\b(urgente|urgencia|critico|critica|alto impacto)\b/.test(normalized);
        const hasClassify = /\b(clasifica|clasificar|prioridad|categoria)\b/.test(normalized)
            || (hasUrgency && /\b(crea|crear|registra|registrar|guarda|guardar)\b/.test(normalized));
        const hasCreate = this.isCreateTicketIntent(text)
            || (hasSummary && /\b(crea|crear|registra|registrar|guarda|guardar)\b/.test(normalized))
            || /\b(crea|crear|registra|registrar|guarda|guardar)\b.*\b(ticket|incidencia|problema)\b/.test(normalized);

        const requestedTools = [];
        if (hasSummary) {
            requestedTools.push('summary');
        }
        if (hasClassify) {
            requestedTools.push('classify');
        }
        if (hasCreate) {
            requestedTools.push('create_ticket');
        }

        if (requestedTools.length === 0) {
            if (fallbackIntent === 'create_ticket') {
                requestedTools.push('create_ticket');
            } else if (['draft', 'summary', 'classify'].includes(fallbackIntent)) {
                requestedTools.push(fallbackIntent);
            }
        }

        const deduped = this.dedupeToolsInOrder(requestedTools);
        if (deduped.includes('create_ticket') && !deduped.includes('draft')) {
            const insertIndex = deduped.indexOf('create_ticket');
            deduped.splice(insertIndex, 0, 'draft');
        }

        return deduped;
    }

    createPlanStepsFromTools(tools) {
        return (Array.isArray(tools) ? tools : []).map((tool) => ({
            tool,
            status: 'pending'
        }));
    }

    inferPrimaryIntentFromTools(tools, fallbackIntent) {
        const ordered = Array.isArray(tools) ? tools : [];
        if (ordered.includes('inventory_alerts')) {
            return 'inventory_alerts';
        }
        if (ordered.includes('inventory_low_stock')) {
            return 'inventory_low_stock';
        }
        if (ordered.includes('inventory_summary')) {
            return 'inventory_summary';
        }
        if (ordered.includes('inventory_list')) {
            return 'inventory_list';
        }
        if (ordered.includes('create_ticket')) {
            return 'create_ticket';
        }
        if (ordered.includes('draft')) {
            return 'draft';
        }
        if (ordered.includes('summary')) {
            return 'summary';
        }
        if (ordered.includes('classify')) {
            return 'classify';
        }

        return fallbackIntent;
    }

    async executePlanStep({
        step,
        trimmedText,
        context,
        sessionId,
        recentContext,
        previews,
        allowCriticalExecution = false,
        aiLogId = null
    }) {
        if (!step || !step.tool) {
            return { requiresConfirmation: false };
        }

        if (step.tool === 'inventory_list') {
            const items = await InventoryService.getAllInventoryItems({
                workspaceId: context.workspaceId
            });

            previews.inventory_list_preview = {
                total: items.length,
                items
            };
            previews.inventory_message = this.buildInventoryListMessage(items);
            return { requiresConfirmation: false };
        }

        if (step.tool === 'inventory_summary') {
            const summary = await InventoryService.getInventorySummary({
                workspaceId: context.workspaceId
            });

            previews.inventory_summary_preview = summary;
            previews.inventory_message = this.buildInventorySummaryMessage(summary);
            return { requiresConfirmation: false };
        }

        if (step.tool === 'inventory_low_stock') {
            const lowStock = await InventoryService.getLowStockItems({
                workspaceId: context.workspaceId
            });

            previews.inventory_low_stock_preview = lowStock;
            previews.inventory_message = this.buildInventoryLowStockMessage(lowStock);
            return { requiresConfirmation: false };
        }

        if (step.tool === 'inventory_alerts') {
            const alerts = await InventoryService.getInventoryAlerts({
                workspaceId: context.workspaceId
            });

            previews.inventory_alerts_preview = alerts;
            previews.inventory_message = this.buildInventoryAlertsMessage(alerts);
            return { requiresConfirmation: false };
        }

        if (step.tool === 'summary') {
            const dbTickets = await Tickets.find({
                workspace_id: context.workspaceId,
                is_deleted: false
            }).lean();

            if (!dbTickets || dbTickets.length === 0) {
                previews.summary_preview = { resumen: 'No hay tickets en este workspace para analizar.' };
                return { requiresConfirmation: false };
            }

            let scope = 'generic';
            const textLower = trimmedText.toLowerCase();
            if (textLower.includes('hoy') || textLower.includes('día') || textLower.includes('diario')) {
                scope = 'daily';
            } else if (textLower.includes('semana') || textLower.includes('semanal')) {
                scope = 'weekly';
            }

            const ticketsForSummary = dbTickets.map((t) => ({
                titulo: t.titulo,
                descripcion: t.descripcion,
                estado: t.estado || 'ABIERTO',
                prioridad: t.prioridad || 'BAJA',
                categoria: t.categoria || 'SOPORTE'
            }));

            const summary = await AIService.summaryTickets({
                tickets: ticketsForSummary,
                scope
            });

            previews.summary_preview = { resumen: summary.resumen };
            return { requiresConfirmation: false };
        }

        if (step.tool === 'classify') {
            const descripcion = this.normalizeClassifyDescription(trimmedText);
            const classify = await AIService.classifyTickets({ descripcion });
            previews.classify_preview = {
                prioridad: classify.prioridad,
                categoria: classify.categoria,
                justificacion: classify.justificacion,
                confidence: classify.confidence
            };
            return { requiresConfirmation: false };
        }

        if (step.tool === 'draft') {
            const needsGrounding = AgentMemoryService.isReferentialOrShortCreateText(trimmedText);
            const grounding = needsGrounding
                ? await AgentMemoryService.resolveCreateTicketGrounding({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    sessionId,
                    currentText: trimmedText,
                    recentContext
                })
                : null;

            const draft = grounding?.draftPreview
                ? grounding.draftPreview
                : await AIService.createTicketDraft({
                    text: grounding?.groundedText || trimmedText,
                    userId: context.userId,
                    workspaceId: context.workspaceId
                });

            previews.draft_preview = {
                titulo: draft.titulo,
                descripcion: draft.descripcion,
                prioridad: draft.prioridad,
                categoria: draft.categoria
            };

            if (grounding?.source) {
                previews.grounding_source = grounding.source;
            }

            return { requiresConfirmation: false };
        }

        if (step.tool === 'create_ticket') {
            if (!allowCriticalExecution) {
                return { requiresConfirmation: true };
            }

            const existingDraft = previews.draft_preview;
            const draft = existingDraft
                || await AIService.createTicketDraft({
                    text: trimmedText,
                    userId: context.userId,
                    workspaceId: context.workspaceId
                });

            previews.draft_preview = {
                titulo: draft.titulo,
                descripcion: draft.descripcion,
                prioridad: draft.prioridad,
                categoria: draft.categoria
            };

            const ticket = await TicketsFromAIService.createFromDraft({
                draft: previews.draft_preview,
                jwtUserId: context.mode === 'jwt' ? context.userId : null,
                aiLogId: null
            });

            return {
                requiresConfirmation: false,
                executionResult: {
                    status: 'ticket_created',
                    ticket_id: ticket._id.toString(),
                    ai_log_id: aiLogId || null
                }
            };
        }

        return { requiresConfirmation: false };
    }

    normalizeClassifyDescription(text) {
        const classifyPrefix = /^clasifica(?:\s+este\s+(?:problema|ticket))?\s*[:\-]?\s*/i;
        const normalized = text.replace(classifyPrefix, '').trim();
        return normalized || text;
    }

    resolveSessionId(requestedSessionId) {
        if (typeof requestedSessionId === 'string' && requestedSessionId.trim()) {
            return requestedSessionId.trim();
        }

        return randomUUID();
    }

    summarizeText(value, maxLength = 280) {
        if (typeof value !== 'string') {
            return '';
        }

        const normalized = value.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            return '';
        }

        if (normalized.length <= maxLength) {
            return normalized;
        }

        return `${normalized.slice(0, maxLength - 3)}...`;
    }

    buildResultSummary(value) {
        if (!value) {
            return '';
        }

        if (typeof value === 'string') {
            return this.summarizeText(value);
        }

        try {
            return this.summarizeText(JSON.stringify(value));
        } catch (_error) {
            return '';
        }
    }

    async appendConversationMemory({
        userId,
        workspaceId,
        sessionId,
        userText,
        intent,
        assistantText,
        resultSummary
    }) {
        try {
            await AgentMemoryService.appendExchange({
                userId,
                workspaceId,
                sessionId,
                userText,
                intent,
                assistantText,
                resultSummary
            });
        } catch (_error) {
            // Memory must not break agent responses in this lightweight iteration.
        }
    }

    async resolveExecutionContext(req, requestedWorkspaceId) {
        if (req.jwt?.sub) {
            const userId = req.jwt.sub;
            const workspaceId = await this.resolveWorkspaceId(userId, requestedWorkspaceId);
            return { userId, workspaceId, mode: 'jwt' };
        }

        if (process.env.AI_DEMO_MODE === 'true') {
            const userId = process.env.AI_DEMO_USER_ID;
            const workspaceId = process.env.AI_DEMO_WORKSPACE_ID;

            if (!userId || !workspaceId) {
                const error = new Error('Variables de demo no configuradas correctamente');
                error.status = 500;
                throw error;
            }

            return { userId, workspaceId, mode: 'demo' };
        }

        const error = new Error('Autenticación requerida');
        error.status = 401;
        throw error;
    }

    buildPlanResponse({
        ai_log_id,
        session_id,
        intent,
        confidence,
        message,
        requires_confirmation,
        plan,
        steps,
        draft_preview,
        summary_preview,
        classify_preview,
        inventory_list_preview,
        inventory_summary_preview,
        inventory_low_stock_preview,
        inventory_alerts_preview,
        inventory_message,
        execution_result,
        blocked_reason,
        guidance
    }) {
        const response = {
            intent,
            confidence,
            message,
            requires_confirmation,
            plan: Array.isArray(plan) ? plan : (Array.isArray(steps) ? steps : []),
            steps
        };

        if (ai_log_id) {
            response.ai_log_id = ai_log_id;
        }

        if (session_id) {
            response.session_id = session_id;
        }

        if (draft_preview) {
            response.draft_preview = draft_preview;
        }
        if (summary_preview) {
            response.summary_preview = summary_preview;
        }
        if (classify_preview) {
            response.classify_preview = classify_preview;
        }
        if (inventory_list_preview) {
            response.inventory_list_preview = inventory_list_preview;
        }
        if (inventory_summary_preview) {
            response.inventory_summary_preview = inventory_summary_preview;
        }
        if (inventory_low_stock_preview) {
            response.inventory_low_stock_preview = inventory_low_stock_preview;
        }
        if (inventory_alerts_preview) {
            response.inventory_alerts_preview = inventory_alerts_preview;
        }
        if (inventory_message) {
            response.inventory_message = inventory_message;
        }
        if (execution_result) {
            response.execution_result = execution_result;
        }
        if (blocked_reason) {
            response.blocked_reason = blocked_reason;
        }
        if (guidance) {
            response.guidance = guidance;
        }

        return response;
    }

    async buildBlockedAgentResponse({
        context,
        sessionId,
        trimmedText,
        source,
        policy,
        confidence = 1
    }) {
        const previewResumen = {
            session_id: sessionId,
            blocked_reason: policy.reason,
            guidance: policy.guidance
        };

        const log = await this.createInteractionLog({
            userId: context.userId,
            workspaceId: context.workspaceId,
            mode: context.mode,
            source,
            userText: trimmedText,
            intent: policy.intent,
            confidence,
            requiresConfirmation: false,
            steps: [],
            previewResumen,
            executed: true,
            executionResult: {
                status: 'blocked',
                reason: policy.reason
            }
        });

        await this.appendConversationMemory({
            userId: context.userId,
            workspaceId: context.workspaceId,
            sessionId,
            userText: trimmedText,
            intent: policy.intent,
            assistantText: policy.message,
            resultSummary: this.buildResultSummary(previewResumen)
        });

        return {
            log,
            previewResumen
        };
    }

    async createInteractionLog({
        userId,
        workspaceId,
        mode,
        source,
        userText,
        intent,
        confidence,
        requiresConfirmation,
        steps,
        previewResumen,
        executed,
        executionResult
    }) {
        return AILogsService.createLog({
            user_id: userId,
            workspace_id: workspaceId,
            mode,
            source,
            user_text: userText,
            intent,
            confidence,
            requires_confirmation: Boolean(requiresConfirmation),
            steps: Array.isArray(steps) ? steps : [],
            preview_resumen: previewResumen || null,
            executed: Boolean(executed),
            execution_result: executionResult || null
        });
    }

    async planAgent(req, res) {
        try {
            const {
                text,
                workspace_id: requestedWorkspaceId,
                session_id: requestedSessionId
            } = req.body;

            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({ message: 'El campo text es requerido' });
            }

            const trimmedText = text.trim();
            const context = await this.resolveExecutionContext(req, requestedWorkspaceId);
            const sessionId = this.resolveSessionId(requestedSessionId);
            const recentContext = await AgentMemoryService.getRecentContext({
                userId: context.userId,
                workspaceId: context.workspaceId,
                sessionId
            });

            const policy = this.evaluateRequestPolicy(trimmedText);
            if (policy) {
                const { log } = await this.buildBlockedAgentResponse({
                    context,
                    sessionId,
                    trimmedText,
                    source: 'agent_plan_policy',
                    policy
                });

                return res.status(200).json(this.buildPlanResponse({
                    ai_log_id: log._id,
                    session_id: sessionId,
                    intent: policy.intent,
                    confidence: 1,
                    message: policy.message,
                    requires_confirmation: false,
                    plan: [],
                    steps: [],
                    execution_result: { status: 'blocked', reason: policy.reason },
                    blocked_reason: policy.reason,
                    guidance: policy.guidance
                }));
            }

            const directInventoryIntent = this.detectInventoryIntent(trimmedText);
            let baseAction;
            let confidence;

            if (directInventoryIntent) {
                baseAction = directInventoryIntent;
                confidence = 0.98;
            } else {
                const decision = await AIService.decideAction({
                    text: trimmedText,
                    context: recentContext
                });
                baseAction = decision.action;
                confidence = decision.confidence;
            }
            const hintedIntent = this.isCreateTicketIntent(trimmedText) ? 'create_ticket' : baseAction;
            const tools = this.buildToolPlanFromText(trimmedText, hintedIntent);

            if (!tools.length) {
                return res.status(400).json({
                    message: `Intención no soportada para planeación: "${hintedIntent}"`,
                    intent: hintedIntent,
                    confidence
                });
            }

            const steps = this.createPlanStepsFromTools(tools);
            const previews = {};
            let requiresConfirmation = false;
            let finalMessage = 'Plan generado con múltiples pasos.';

            for (let index = 0; index < steps.length; index += 1) {
                const step = steps[index];
                if (step.status === 'requires_confirmation') {
                    break;
                }

                step.status = 'running';
                const execution = await this.executePlanStep({
                    step,
                    trimmedText,
                    context,
                    sessionId,
                    recentContext,
                    previews
                });

                if (execution.requiresConfirmation) {
                    step.status = 'requires_confirmation';
                    requiresConfirmation = true;
                    finalMessage = 'Plan preparado: hay pasos ejecutados y se requiere confirmación para continuar.';
                    break;
                }

                step.status = 'completed';
            }

            if (!requiresConfirmation) {
                finalMessage = 'Plan ejecutado correctamente.';
            }

            if (previews.inventory_message) {
                finalMessage = previews.inventory_message;
            }

            const intent = this.inferPrimaryIntentFromTools(tools, hintedIntent);

            const memorySummary = {
                session_id: sessionId,
                plan: steps,
                ...previews
            };

            const log = await this.createInteractionLog({
                userId: context.userId,
                workspaceId: context.workspaceId,
                mode: context.mode,
                source: 'agent_plan',
                userText: trimmedText,
                intent,
                confidence,
                requiresConfirmation,
                steps,
                previewResumen: memorySummary,
                executed: !requiresConfirmation
            });

            const finalizePlan = async ({
                aiLogId,
                finalIntent,
                finalMessage,
                requiresConfirmation,
                plan,
                steps,
                draftPreview,
                summaryPreview,
                classifyPreview,
                inventoryListPreview,
                inventorySummaryPreview,
                inventoryLowStockPreview,
                inventoryAlertsPreview,
                inventoryMessage,
                memorySummary
            }) => {
                const response = this.buildPlanResponse({
                    ai_log_id: aiLogId,
                    session_id: sessionId,
                    intent: finalIntent,
                    confidence,
                    message: finalMessage,
                    requires_confirmation: requiresConfirmation,
                    plan,
                    steps,
                    draft_preview: draftPreview,
                    summary_preview: summaryPreview,
                    classify_preview: classifyPreview,
                    inventory_list_preview: inventoryListPreview,
                    inventory_summary_preview: inventorySummaryPreview,
                    inventory_low_stock_preview: inventoryLowStockPreview,
                    inventory_alerts_preview: inventoryAlertsPreview,
                    inventory_message: inventoryMessage
                });

                await this.appendConversationMemory({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    sessionId,
                    userText: trimmedText,
                    intent: finalIntent,
                    assistantText: finalMessage,
                    resultSummary: this.buildResultSummary(memorySummary)
                });

                return res.status(200).json(response);
            };

            return finalizePlan({
                aiLogId: log._id,
                finalIntent: intent,
                finalMessage,
                requiresConfirmation,
                plan: steps,
                steps,
                draftPreview: previews.draft_preview,
                summaryPreview: previews.summary_preview,
                classifyPreview: previews.classify_preview,
                inventoryListPreview: previews.inventory_list_preview,
                inventorySummaryPreview: previews.inventory_summary_preview,
                inventoryLowStockPreview: previews.inventory_low_stock_preview,
                inventoryAlertsPreview: previews.inventory_alerts_preview,
                inventoryMessage: previews.inventory_message,
                memorySummary
            });
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }

    async continueAgentPlan(req, res) {
        try {
            const { ai_log_id: aiLogId } = req.body || {};
            if (!aiLogId || typeof aiLogId !== 'string') {
                return res.status(400).json({ message: 'El campo ai_log_id es requerido' });
            }

            const log = await AILogsService.getLogById({ logId: aiLogId.trim() });
            if (!log) {
                return res.status(404).json({ message: 'No se encontró el plan para continuar' });
            }

            const requester = await this.resolveExecutionContext(req, log.workspace_id?.toString?.() || log.workspace_id);
            if ((log.user_id?.toString?.() || log.user_id) !== requester.userId) {
                return res.status(403).json({ message: 'No autorizado para continuar este plan' });
            }

            const context = {
                userId: log.user_id?.toString?.() || log.user_id,
                workspaceId: log.workspace_id?.toString?.() || log.workspace_id,
                mode: log.mode || requester.mode
            };

            const steps = Array.isArray(log.steps)
                ? log.steps.map((step) => ({ tool: step.tool, status: step.status }))
                : [];

            if (!steps.length) {
                return res.status(400).json({ message: 'El plan no tiene pasos para continuar' });
            }

            const startIndex = steps.findIndex((step) => (
                step.status === 'requires_confirmation'
                || step.status === 'pending'
                || step.status === 'running'
            ));

            if (startIndex < 0) {
                return res.status(200).json(this.buildPlanResponse({
                    ai_log_id: log._id,
                    session_id: log.preview_resumen?.session_id || null,
                    intent: log.intent,
                    confidence: log.confidence,
                    message: 'Plan ya completado. No hay pasos pendientes.',
                    requires_confirmation: false,
                    plan: steps,
                    steps,
                    draft_preview: log.preview_resumen?.draft_preview,
                    summary_preview: log.preview_resumen?.summary_preview,
                    classify_preview: log.preview_resumen?.classify_preview,
                    execution_result: log.execution_result
                }));
            }

            const previews = {
                ...(log.preview_resumen && typeof log.preview_resumen === 'object' ? log.preview_resumen : {})
            };
            const trimmedText = typeof log.user_text === 'string' ? log.user_text.trim() : '';
            let requiresConfirmation = false;
            let executionResult = log.execution_result || null;

            for (let index = startIndex; index < steps.length; index += 1) {
                const step = steps[index];
                if (step.status === 'completed') {
                    continue;
                }

                const allowCriticalExecution = index === startIndex && step.status === 'requires_confirmation';
                step.status = 'running';

                const execution = await this.executePlanStep({
                    step,
                    trimmedText,
                    context,
                    sessionId: previews.session_id || null,
                    recentContext: [],
                    previews,
                    allowCriticalExecution,
                    aiLogId: log._id.toString()
                });

                if (execution.requiresConfirmation) {
                    step.status = 'requires_confirmation';
                    requiresConfirmation = true;
                    break;
                }

                step.status = 'completed';
                if (execution.executionResult) {
                    executionResult = execution.executionResult;
                }
            }

            const pendingOrBlocking = steps.some((step) => (
                step.status !== 'completed' && step.status !== 'skipped'
            ));
            const executed = !pendingOrBlocking;

            const previewResumen = {
                ...previews,
                plan: steps
            };

            await AILogsService.updatePlanState({
                logId: log._id.toString(),
                userId: context.userId,
                workspaceId: context.workspaceId,
                steps,
                requiresConfirmation,
                previewResumen,
                executed,
                executionResult
            });

            if (previews.session_id) {
                await this.appendConversationMemory({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    sessionId: previews.session_id,
                    userText: trimmedText || 'continuar plan',
                    intent: log.intent,
                    assistantText: executed
                        ? 'Plan continuado y completado correctamente.'
                        : 'Plan continuado parcialmente; se requiere una nueva confirmación.',
                    resultSummary: this.buildResultSummary(previewResumen)
                });
            }

            return res.status(200).json(this.buildPlanResponse({
                ai_log_id: log._id,
                session_id: previews.session_id || null,
                intent: log.intent,
                confidence: log.confidence,
                message: executed
                    ? 'Plan continuado y completado correctamente.'
                    : 'Plan continuado: se requiere confirmación para el siguiente paso crítico.',
                requires_confirmation: requiresConfirmation,
                plan: steps,
                steps,
                draft_preview: previews.draft_preview,
                summary_preview: previews.summary_preview,
                classify_preview: previews.classify_preview,
                inventory_list_preview: previews.inventory_list_preview,
                inventory_summary_preview: previews.inventory_summary_preview,
                inventory_low_stock_preview: previews.inventory_low_stock_preview,
                inventory_alerts_preview: previews.inventory_alerts_preview,
                inventory_message: previews.inventory_message,
                execution_result: executionResult
            }));
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }

    async routeAgent(req, res) {
        try {
            const {
                text,
                workspace_id: requestedWorkspaceId,
                session_id: requestedSessionId
            } = req.body;

            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({ message: 'El campo text es requerido' });
            }

            // Step 1: ask the AI micro-service which action to execute
            const trimmedText = text.trim();
            const context = await this.resolveExecutionContext(req, requestedWorkspaceId);
            const sessionId = this.resolveSessionId(requestedSessionId);
            const recentContext = await AgentMemoryService.getRecentContext({
                userId: context.userId,
                workspaceId: context.workspaceId,
                sessionId
            });
            const policy = this.evaluateRequestPolicy(trimmedText);
            if (policy) {
                const { log } = await this.buildBlockedAgentResponse({
                    context,
                    sessionId,
                    trimmedText,
                    source: 'agent_policy',
                    policy
                });

                return res.status(200).json({
                    action: policy.intent,
                    confidence: 1,
                    session_id: sessionId,
                    ai_log_id: log._id,
                    message: policy.message,
                    result: {
                        blocked: true,
                        blocked_reason: policy.reason,
                        guidance: policy.guidance
                    }
                });
            }
            const directInventoryIntent = this.detectInventoryIntent(trimmedText);
            let action;
            let confidence;

            if (directInventoryIntent) {
                action = directInventoryIntent;
                confidence = 0.98;
            } else {
                const decision = await AIService.decideAction({
                    text: trimmedText,
                    context: recentContext
                });
                action = decision.action;
                confidence = decision.confidence;
            }

            const finalizeRoute = async ({
                aiLogId,
                finalAction,
                result,
                message
            }) => {
                await this.appendConversationMemory({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    sessionId,
                    userText: trimmedText,
                    intent: finalAction,
                    assistantText: message || 'Acción ejecutada',
                    resultSummary: this.buildResultSummary(result)
                });

                const response = {
                    action: finalAction,
                    confidence,
                    session_id: sessionId,
                    ai_log_id: aiLogId,
                    result
                };

                if (message) {
                    response.message = message;
                }

                return res.status(200).json(response);
            };

            const VALID_ACTIONS = ['draft', 'classify', 'summary', 'inventory_list', 'inventory_summary', 'inventory_low_stock', 'inventory_alerts'];
            if (!VALID_ACTIONS.includes(action)) {
                return res.status(400).json({
                    message: `Acción no reconocida: "${action}". Válidas: ${VALID_ACTIONS.join(', ')}`
                });
            }

            if (action === 'inventory_list') {
                const items = await InventoryService.getAllInventoryItems({
                    workspaceId: context.workspaceId
                });
                const message = this.buildInventoryListMessage(items);
                const result = {
                    total_articulos: items.length,
                    items,
                    mensaje: message
                };

                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'inventory_list', status: 'executed' }],
                    previewResumen: {
                        inventory_list_preview: {
                            total: items.length,
                            items
                        },
                        inventory_message: message
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message
                });
            }

            if (action === 'inventory_summary') {
                const summary = await InventoryService.getInventorySummary({
                    workspaceId: context.workspaceId
                });
                const message = this.buildInventorySummaryMessage(summary);
                const result = {
                    ...summary,
                    mensaje: message
                };

                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'inventory_summary', status: 'executed' }],
                    previewResumen: {
                        inventory_summary_preview: summary,
                        inventory_message: message
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message
                });
            }

            if (action === 'inventory_low_stock') {
                const lowStock = await InventoryService.getLowStockItems({
                    workspaceId: context.workspaceId
                });
                const message = this.buildInventoryLowStockMessage(lowStock);
                const result = {
                    ...lowStock,
                    mensaje: message
                };

                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'inventory_low_stock', status: 'executed' }],
                    previewResumen: {
                        inventory_low_stock_preview: lowStock,
                        inventory_message: message
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message
                });
            }

            if (action === 'inventory_alerts') {
                const alerts = await InventoryService.getInventoryAlerts({
                    workspaceId: context.workspaceId
                });
                const message = this.buildInventoryAlertsMessage(alerts);
                const result = {
                    ...alerts,
                    mensaje: message
                };

                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'inventory_alerts', status: 'executed' }],
                    previewResumen: {
                        inventory_alerts_preview: alerts,
                        inventory_message: message
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message
                });
            }

            // Step 2: route to the matching handler
            if (action === 'draft') {
                const result = await AIService.createTicketDraft({
                    text: trimmedText,
                    userId: context.userId,
                    workspaceId: context.workspaceId
                });
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'draft', status: 'executed' }],
                    previewResumen: {
                        draft_preview: {
                            titulo: result.titulo,
                            descripcion: result.descripcion,
                            prioridad: result.prioridad,
                            categoria: result.categoria
                        }
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });
                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message: 'Borrador generado correctamente.'
                });
            }

            if (action === 'summary') {
                // Fetch tickets from MongoDB
                const dbTickets = await Tickets.find({
                    workspace_id: context.workspaceId,
                    is_deleted: false
                }).lean();

                if (!dbTickets || dbTickets.length === 0) {
                    const emptyResult = {
                        resumen: 'No hay tickets en este workspace para analizar',
                        tickets_criticos: 0,
                        problemas_recurrentes: [],
                        recomendacion: 'Crea tickets para obtener análisis'
                    };
                    const log = await this.createInteractionLog({
                        userId: context.userId,
                        workspaceId: context.workspaceId,
                        mode: context.mode,
                        source: 'agent',
                        userText: trimmedText,
                        intent: action,
                        confidence,
                        requiresConfirmation: false,
                        steps: [{ tool: 'summary', status: 'executed' }],
                        previewResumen: { summary_preview: { resumen: emptyResult.resumen } },
                        executed: true,
                        executionResult: { status: 'completed' }
                    });

                    return finalizeRoute({
                        aiLogId: log._id,
                        finalAction: action,
                        result: emptyResult,
                        message: 'Resumen generado. No hay tickets en este workspace para analizar.'
                    });
                }

                // Detect scope from text (daily/weekly/generic)
                let scope = 'generic';
                const textLower = trimmedText.toLowerCase();
                if (textLower.includes('hoy') || textLower.includes('día') || textLower.includes('diario')) {
                    scope = 'daily';
                } else if (textLower.includes('semana') || textLower.includes('semanal')) {
                    scope = 'weekly';
                }

                // Prepare tickets for summary service
                const ticketsForSummary = dbTickets.map(t => ({
                    titulo: t.titulo,
                    descripcion: t.descripcion,
                    estado: t.estado || 'ABIERTO',
                    prioridad: t.prioridad || 'BAJA',
                    categoria: t.categoria || 'SOPORTE'
                }));

                const result = await AIService.summaryTickets({
                    tickets: ticketsForSummary,
                    scope
                });
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'summary', status: 'executed' }],
                    previewResumen: { summary_preview: { resumen: result.resumen } },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message: 'Resumen generado correctamente.'
                });
            }

            if (action === 'classify') {
                const descripcion = this.normalizeClassifyDescription(trimmedText);

                const result = await AIService.classifyTickets({ descripcion });
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent',
                    userText: trimmedText,
                    intent: action,
                    confidence,
                    requiresConfirmation: false,
                    steps: [{ tool: 'classify', status: 'executed' }],
                    previewResumen: {
                        classify_preview: {
                            prioridad: result.prioridad,
                            categoria: result.categoria,
                            justificacion: result.justificacion,
                            confidence: result.confidence
                        }
                    },
                    executed: true,
                    executionResult: { status: 'completed' }
                });

                return finalizeRoute({
                    aiLogId: log._id,
                    finalAction: action,
                    result,
                    message: 'Clasificación generada correctamente.'
                });
            }

            return res.status(400).json({
                message: `Acción no soportada por el router: "${action}"`,
                action,
                confidence
            });
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }

    async createTicketDraftDemo(req, res) {
        // Validar que demo mode este habilitado
        if (process.env.AI_DEMO_MODE !== 'true') {
            return res.status(403).json({
                message: 'Demo mode esta deshabilitado'
            });
        }

        try {
            const { text } = req.body;

            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({
                    message: 'El campo text es requerido'
                });
            }

            const userId = process.env.AI_DEMO_USER_ID;
            const workspaceId = process.env.AI_DEMO_WORKSPACE_ID;

            if (!userId || !workspaceId) {
                return res.status(500).json({
                    message: 'Variables de demo no configuradas correctamente'
                });
            }

            const draft = await AIService.createTicketDraft({
                text: text.trim(),
                userId,
                workspaceId
            });

            return res.status(200).json(draft);
        } catch (error) {
            return res.status(error.status || 500).json({
                message: error.message
            });
        }
    }
}

module.exports = new AIController();