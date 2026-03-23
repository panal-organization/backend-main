const { randomUUID } = require('crypto');
const { AIService, AILogsService, AgentMemoryService } = require('../services');
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
        steps,
        draft_preview,
        summary_preview,
        classify_preview
    }) {
        const response = {
            intent,
            confidence,
            message,
            requires_confirmation,
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

        return response;
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

            const decision = await AIService.decideAction({
                text: trimmedText,
                context: recentContext
            });
            const baseAction = decision.action;
            const confidence = decision.confidence;
            const intent = this.isCreateTicketIntent(trimmedText) ? 'create_ticket' : baseAction;

            const finalizePlan = async ({
                aiLogId,
                finalIntent,
                finalMessage,
                requiresConfirmation,
                steps,
                draftPreview,
                summaryPreview,
                classifyPreview,
                memorySummary
            }) => {
                const response = this.buildPlanResponse({
                    ai_log_id: aiLogId,
                    session_id: sessionId,
                    intent: finalIntent,
                    confidence,
                    message: finalMessage,
                    requires_confirmation: requiresConfirmation,
                    steps,
                    draft_preview: draftPreview,
                    summary_preview: summaryPreview,
                    classify_preview: classifyPreview
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

            if (intent === 'draft') {
                const draft = await AIService.createTicketDraft({
                    text: trimmedText,
                    userId: context.userId,
                    workspaceId: context.workspaceId
                });
                const steps = [{ tool: 'draft', status: 'ready' }];
                const preview = {
                    draft_preview: {
                        titulo: draft.titulo,
                        descripcion: draft.descripcion,
                        prioridad: draft.prioridad,
                        categoria: draft.categoria
                    }
                };
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent_plan',
                    userText: trimmedText,
                    intent,
                    confidence,
                    requiresConfirmation: false,
                    steps,
                    previewResumen: preview,
                    executed: false
                });

                return finalizePlan({
                    aiLogId: log._id,
                    finalIntent: intent,
                    finalMessage: 'Plan listo: se puede generar un borrador de ticket.',
                    requiresConfirmation: false,
                    steps,
                    draftPreview: preview.draft_preview,
                    memorySummary: preview
                });
            }

            if (intent === 'classify') {
                const descripcion = this.normalizeClassifyDescription(trimmedText);
                const classify = await AIService.classifyTickets({ descripcion });
                const steps = [{ tool: 'classify', status: 'ready' }];
                const preview = {
                    classify_preview: {
                        prioridad: classify.prioridad,
                        categoria: classify.categoria,
                        justificacion: classify.justificacion,
                        confidence: classify.confidence
                    }
                };
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent_plan',
                    userText: trimmedText,
                    intent,
                    confidence,
                    requiresConfirmation: false,
                    steps,
                    previewResumen: preview,
                    executed: false
                });

                return finalizePlan({
                    aiLogId: log._id,
                    finalIntent: intent,
                    finalMessage: 'Plan listo: se puede clasificar el problema.',
                    requiresConfirmation: false,
                    steps,
                    classifyPreview: preview.classify_preview,
                    memorySummary: preview
                });
            }

            if (intent === 'summary') {
                const dbTickets = await Tickets.find({
                    workspace_id: context.workspaceId,
                    is_deleted: false
                }).lean();

                if (!dbTickets || dbTickets.length === 0) {
                    const steps = [{ tool: 'summary', status: 'ready' }];
                    const preview = { summary_preview: { resumen: 'No hay tickets en este workspace para analizar.' } };
                    const log = await this.createInteractionLog({
                        userId: context.userId,
                        workspaceId: context.workspaceId,
                        mode: context.mode,
                        source: 'agent_plan',
                        userText: trimmedText,
                        intent,
                        confidence,
                        requiresConfirmation: false,
                        steps,
                        previewResumen: preview,
                        executed: false
                    });

                    return finalizePlan({
                        aiLogId: log._id,
                        finalIntent: intent,
                        finalMessage: 'Plan listo: no hay tickets para resumir en este workspace.',
                        requiresConfirmation: false,
                        steps,
                        summaryPreview: preview.summary_preview,
                        memorySummary: preview
                    });
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
                const steps = [{ tool: 'summary', status: 'ready' }];
                const preview = { summary_preview: { resumen: summary.resumen } };
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent_plan',
                    userText: trimmedText,
                    intent,
                    confidence,
                    requiresConfirmation: false,
                    steps,
                    previewResumen: preview,
                    executed: false
                });

                return finalizePlan({
                    aiLogId: log._id,
                    finalIntent: intent,
                    finalMessage: 'Plan listo: se puede generar el resumen de tickets.',
                    requiresConfirmation: false,
                    steps,
                    summaryPreview: preview.summary_preview,
                    memorySummary: preview
                });
            }

            if (intent === 'create_ticket') {
                const isReferentialCreate = AgentMemoryService.isReferentialOrShortCreateText(trimmedText);
                const grounding = isReferentialCreate
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
                const steps = [
                    { tool: 'draft', status: 'ready' },
                    { tool: 'create_ticket_from_draft', status: 'requires_confirmation' }
                ];
                const preview = {
                    draft_preview: {
                        titulo: draft.titulo,
                        descripcion: draft.descripcion,
                        prioridad: draft.prioridad,
                        categoria: draft.categoria
                    }
                };
                if (grounding?.source) {
                    preview.grounding_source = grounding.source;
                }
                const log = await this.createInteractionLog({
                    userId: context.userId,
                    workspaceId: context.workspaceId,
                    mode: context.mode,
                    source: 'agent_plan',
                    userText: trimmedText,
                    intent,
                    confidence,
                    requiresConfirmation: true,
                    steps,
                    previewResumen: preview,
                    executed: false
                });

                return finalizePlan({
                    aiLogId: log._id,
                    finalIntent: intent,
                    finalMessage: 'Plan preparado: el ticket requiere confirmación antes de guardarse.',
                    requiresConfirmation: true,
                    steps,
                    draftPreview: preview.draft_preview,
                    memorySummary: preview
                });
            }

            return res.status(400).json({
                message: `Intención no soportada para planeación: "${intent}"`,
                intent,
                confidence
            });
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
            const decision = await AIService.decideAction({
                text: trimmedText,
                context: recentContext
            });
            const { action, confidence } = decision;

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

            const VALID_ACTIONS = ['draft', 'classify', 'summary'];
            if (!VALID_ACTIONS.includes(action)) {
                return res.status(400).json({
                    message: `Acción no reconocida: "${action}". Válidas: ${VALID_ACTIONS.join(', ')}`
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