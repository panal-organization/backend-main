const AgentMemory = require('../models/agent_memory.model');

const MAX_MEMORY_ENTRIES = 5;
const MAX_TEXT_LENGTH = 280;
const CREATE_REFERENTIAL_PATTERNS = [
    /^crea(?:lo|la|los|las)?$/,
    /^haz(?:lo|la)?$/,
    /^registra(?:lo|la)?$/,
    /^guarda(?:lo|la)?$/,
    /^ahora\s+crea(?:\s+el)?\s+ticket$/,
    /^crea(?:\s+el)?\s+ticket$/
];

class AgentMemoryService {
    normalizeText(value) {
        if (typeof value !== 'string') {
            return '';
        }

        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    tryParseJson(value) {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            return null;
        }

        try {
            return JSON.parse(trimmed);
        } catch (_error) {
            return null;
        }
    }

    normalizeDraftPreview(preview) {
        if (!preview || typeof preview !== 'object') {
            return null;
        }

        const titulo = this.summarizeText(preview.titulo || '', 140);
        const descripcion = this.summarizeText(preview.descripcion || '', 700);
        const prioridad = typeof preview.prioridad === 'string' ? preview.prioridad.trim().toUpperCase() : '';
        const categoria = typeof preview.categoria === 'string' ? preview.categoria.trim().toUpperCase() : '';

        if (!titulo && !descripcion) {
            return null;
        }

        return {
            titulo: titulo || 'Ticket generado desde contexto previo',
            descripcion: descripcion || titulo,
            prioridad: prioridad || 'BAJA',
            categoria: categoria || 'SOPORTE'
        };
    }

    inferContextTypeFromIntent(intent) {
        const normalized = this.normalizeText(intent);
        if (!normalized) {
            return null;
        }

        if (normalized.startsWith('inventory_')) {
            return 'inventory';
        }

        if (['draft', 'classify', 'create_ticket', 'summary'].includes(normalized)) {
            return 'tickets';
        }

        return null;
    }

    inferContextTypeFromSummary(summary) {
        if (typeof summary !== 'string' || !summary.trim()) {
            return null;
        }

        const parsed = this.tryParseJson(summary);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const keys = Object.keys(parsed);
        if (keys.some((key) => key.startsWith('inventory_'))) {
            return 'inventory';
        }

        if (keys.some((key) => ['draft_preview', 'summary_preview', 'classify_preview', 'plan'].includes(key))) {
            return 'tickets';
        }

        return null;
    }

    inferContextTypeFromEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        return this.inferContextTypeFromIntent(entry.intent)
            || this.inferContextTypeFromSummary(entry.result_summary)
            || null;
    }

    async getLastContext({ userId, workspaceId, sessionId }) {
        const context = await this.getRecentContext({ userId, workspaceId, sessionId });
        if (!Array.isArray(context) || context.length === 0) {
            return {
                lastIntent: null,
                lastContextType: null,
                lastResultSummary: null,
                lastAssistantText: null,
                lastUserText: null
            };
        }

        let lastAssistant = null;
        let lastUser = null;
        let lastContextType = null;

        for (let index = context.length - 1; index >= 0; index -= 1) {
            const entry = context[index];
            if (!lastAssistant && entry.role === 'assistant') {
                lastAssistant = entry;
            }
            if (!lastUser && entry.role === 'user') {
                lastUser = entry;
            }

            if (!lastContextType) {
                lastContextType = this.inferContextTypeFromEntry(entry);
            }

            if (lastAssistant && lastUser && lastContextType) {
                break;
            }
        }

        return {
            lastIntent: lastAssistant?.intent || null,
            lastContextType,
            lastResultSummary: lastAssistant?.result_summary || null,
            lastAssistantText: lastAssistant?.text || null,
            lastUserText: lastUser?.text || null
        };
    }

    async getLastContextType({ userId, workspaceId, sessionId }) {
        const lastContext = await this.getLastContext({ userId, workspaceId, sessionId });
        return lastContext.lastContextType;
    }

    extractPreview(entry, previewKey) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        const candidates = [];
        if (entry.result_summary) {
            candidates.push(entry.result_summary);
        }
        if (entry.text) {
            candidates.push(entry.text);
        }

        for (const candidate of candidates) {
            const parsed = this.tryParseJson(candidate);
            if (!parsed || typeof parsed !== 'object') {
                continue;
            }

            if (parsed[previewKey] && typeof parsed[previewKey] === 'object') {
                return parsed[previewKey];
            }
        }

        return null;
    }

    isReferentialOrShortCreateText(text) {
        const normalized = this.normalizeText(text);
        if (!normalized) {
            return false;
        }

        if (CREATE_REFERENTIAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
            return true;
        }

        const words = normalized.split(' ').filter(Boolean);
        if (words.length <= 4 && /\b(crea|crear|haz|hacer|registra|registrar|guarda|guardar)\b/.test(normalized)) {
            return true;
        }

        return false;
    }

    isUsefulUserText(text) {
        if (typeof text !== 'string') {
            return false;
        }

        const normalized = this.normalizeText(text);
        if (!normalized) {
            return false;
        }

        if (this.isReferentialOrShortCreateText(normalized)) {
            return false;
        }

        const words = normalized.split(' ').filter(Boolean);
        return normalized.length >= 12 || words.length >= 4;
    }

    buildDraftTextFromPreview(preview) {
        if (!preview) {
            return '';
        }

        return this.summarizeText(
            `Problema reportado: ${preview.titulo}. Detalle: ${preview.descripcion}. Prioridad sugerida: ${preview.prioridad}. Categoria sugerida: ${preview.categoria}.`,
            900
        );
    }

    buildDraftTextFromClassify(classifyPreview, userText) {
        const baseUserText = this.summarizeText(userText || '', 500);
        const prioridad = this.summarizeText(classifyPreview?.prioridad || '', 50);
        const categoria = this.summarizeText(classifyPreview?.categoria || '', 50);
        const justificacion = this.summarizeText(classifyPreview?.justificacion || '', 300);

        const chunks = [];
        if (baseUserText) {
            chunks.push(`Problema reportado: ${baseUserText}.`);
        }
        if (prioridad || categoria) {
            chunks.push(`Clasificacion previa: prioridad ${prioridad || 'no definida'}, categoria ${categoria || 'no definida'}.`);
        }
        if (justificacion) {
            chunks.push(`Justificacion: ${justificacion}.`);
        }

        return this.summarizeText(chunks.join(' '), 900);
    }

    async resolveCreateTicketGrounding({ userId, workspaceId, sessionId, currentText, recentContext = null }) {
        if (!userId || !workspaceId || !sessionId) {
            return null;
        }

        const contextEntries = Array.isArray(recentContext)
            ? recentContext
            : await this.getRecentContext({ userId, workspaceId, sessionId });

        if (!Array.isArray(contextEntries) || contextEntries.length === 0) {
            return null;
        }

        const normalizedCurrent = this.normalizeText(currentText);

        for (let index = contextEntries.length - 1; index >= 0; index -= 1) {
            const entry = contextEntries[index];
            if (entry.role !== 'assistant') {
                continue;
            }

            const draftPreview = this.normalizeDraftPreview(this.extractPreview(entry, 'draft_preview'));
            if (draftPreview) {
                return {
                    source: 'last_draft_preview',
                    groundedText: this.buildDraftTextFromPreview(draftPreview),
                    draftPreview,
                    classifyPreview: null,
                    userText: ''
                };
            }
        }

        let usefulUserText = '';
        for (let index = contextEntries.length - 1; index >= 0; index -= 1) {
            const entry = contextEntries[index];
            if (entry.role !== 'user') {
                continue;
            }

            const normalizedUserText = this.normalizeText(entry.text || '');
            if (!normalizedUserText || normalizedUserText === normalizedCurrent) {
                continue;
            }

            if (this.isUsefulUserText(entry.text)) {
                usefulUserText = entry.text;
                break;
            }
        }

        for (let index = contextEntries.length - 1; index >= 0; index -= 1) {
            const entry = contextEntries[index];
            if (entry.role !== 'assistant') {
                continue;
            }

            const classifyPreview = this.extractPreview(entry, 'classify_preview');
            if (classifyPreview && typeof classifyPreview === 'object') {
                return {
                    source: 'last_classify_preview',
                    groundedText: this.buildDraftTextFromClassify(classifyPreview, usefulUserText),
                    draftPreview: null,
                    classifyPreview,
                    userText: usefulUserText
                };
            }
        }

        if (usefulUserText) {
            return {
                source: 'last_user_text',
                groundedText: this.summarizeText(usefulUserText, 900),
                draftPreview: null,
                classifyPreview: null,
                userText: usefulUserText
            };
        }

        return null;
    }

    summarizeText(value, maxLength = MAX_TEXT_LENGTH) {
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

    async getRecentContext({ userId, workspaceId, sessionId }) {
        if (!userId || !workspaceId || !sessionId) {
            return [];
        }

        const doc = await AgentMemory.findOne({
            user_id: userId,
            workspace_id: workspaceId,
            session_id: sessionId
        }).select({ entries: 1 }).lean();

        if (!doc?.entries || doc.entries.length === 0) {
            return [];
        }

        return doc.entries
            .slice(-MAX_MEMORY_ENTRIES)
            .map((entry) => ({
                role: entry.role,
                text: entry.text,
                intent: entry.intent || null,
                result_summary: entry.result_summary || null,
                created_at: entry.created_at
            }));
    }

    async appendExchange({
        userId,
        workspaceId,
        sessionId,
        userText,
        intent,
        assistantText,
        resultSummary
    }) {
        if (!userId || !workspaceId || !sessionId) {
            return null;
        }

        const userEntryText = this.summarizeText(userText);
        const assistantEntryText = this.summarizeText(assistantText || resultSummary || '');
        const assistantResultSummary = this.summarizeText(resultSummary || assistantText || '');

        if (!userEntryText || !assistantEntryText) {
            return null;
        }

        const now = new Date();
        const entriesToAppend = [
            {
                role: 'user',
                text: userEntryText,
                intent: intent || null,
                result_summary: null,
                created_at: now
            },
            {
                role: 'assistant',
                text: assistantEntryText,
                intent: intent || null,
                result_summary: assistantResultSummary || null,
                created_at: now
            }
        ];

        await AgentMemory.findOneAndUpdate(
            {
                user_id: userId,
                workspace_id: workspaceId,
                session_id: sessionId
            },
            {
                $setOnInsert: {
                    user_id: userId,
                    workspace_id: workspaceId,
                    session_id: sessionId
                },
                $push: {
                    entries: {
                        $each: entriesToAppend,
                        $slice: -MAX_MEMORY_ENTRIES
                    }
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        return true;
    }
}

module.exports = new AgentMemoryService();
