const ALLOWED_PRIORITIES = ['BAJA', 'ALTA', 'CRITICA'];
const ALLOWED_CATEGORIES = ['SOPORTE', 'MEJORA'];

class AIService {
    async createTicketDraft({ text, userId, workspaceId }) {
        const serviceUrl = process.env.AI_SERVICE_URL;
        const internalApiKey = process.env.AI_INTERNAL_API_KEY;

        if (!serviceUrl) {
            const error = new Error('AI_SERVICE_URL no esta configurado');
            error.status = 500;
            throw error;
        }

        if (!internalApiKey) {
            const error = new Error('AI_INTERNAL_API_KEY no esta configurado');
            error.status = 500;
            throw error;
        }

        const response = await this.request(`${serviceUrl.replace(/\/$/, '')}/tickets/draft`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-API-Key': internalApiKey
            },
            body: JSON.stringify({
                text,
                workspace_id: workspaceId,
                user_id: userId,
                allowed_priorities: ALLOWED_PRIORITIES,
                allowed_categories: ALLOWED_CATEGORIES
            }),
            signal: AbortSignal.timeout(60000)
        });

        return response;
    }

    async decideAction({ text, context = [] }) {
        const serviceUrl = process.env.AI_SERVICE_URL;
        const internalApiKey = process.env.AI_INTERNAL_API_KEY;

        if (!serviceUrl) {
            const error = new Error('AI_SERVICE_URL no esta configurado');
            error.status = 500;
            throw error;
        }

        if (!internalApiKey) {
            const error = new Error('AI_INTERNAL_API_KEY no esta configurado');
            error.status = 500;
            throw error;
        }

        const payload = { text };
        if (Array.isArray(context) && context.length > 0) {
            payload.context = context;
        }

        return this.request(`${serviceUrl.replace(/\/$/, '')}/agent/decide`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-API-Key': internalApiKey
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });
    }

    async summaryTickets({ tickets, scope = 'generic' }) {
        const serviceUrl = process.env.AI_SERVICE_URL;
        const internalApiKey = process.env.AI_INTERNAL_API_KEY;

        if (!serviceUrl) {
            const error = new Error('AI_SERVICE_URL no esta configurado');
            error.status = 500;
            throw error;
        }

        if (!internalApiKey) {
            const error = new Error('AI_INTERNAL_API_KEY no esta configurado');
            error.status = 500;
            throw error;
        }

        const response = await this.request(`${serviceUrl.replace(/\/$/, '')}/tickets/summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-API-Key': internalApiKey
            },
            body: JSON.stringify({
                tickets: tickets.map(t => ({
                    titulo: t.titulo || t.title || '',
                    descripcion: t.descripcion || t.description || '',
                    estado: t.estado || t.status || 'ABIERTO',
                    prioridad: t.prioridad || t.priority || 'BAJA',
                    categoria: t.categoria || t.category || 'SOPORTE'
                })),
                scope
            }),
            signal: AbortSignal.timeout(60000)
        });

        return response;
    }

    async classifyTickets({ titulo = null, descripcion }) {
        const serviceUrl = process.env.AI_SERVICE_URL;
        const internalApiKey = process.env.AI_INTERNAL_API_KEY;

        if (!serviceUrl) {
            const error = new Error('AI_SERVICE_URL no esta configurado');
            error.status = 500;
            throw error;
        }

        if (!internalApiKey) {
            const error = new Error('AI_INTERNAL_API_KEY no esta configurado');
            error.status = 500;
            throw error;
        }

        return this.request(`${serviceUrl.replace(/\/$/, '')}/tickets/classify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-API-Key': internalApiKey
            },
            body: JSON.stringify({ titulo, descripcion }),
            signal: AbortSignal.timeout(60000)
        });
    }

    async request(url, options) {
        let response;

        try {
            response = await fetch(url, options);
        } catch (error) {
            const serviceError = new Error(`No se pudo conectar con el microservicio de IA: ${error.message}`);
            serviceError.status = 502;
            throw serviceError;
        }

        const rawBody = await response.text();
        let data = null;

        if (rawBody) {
            try {
                data = JSON.parse(rawBody);
            } catch (error) {
                const parseError = new Error('El microservicio de IA devolvio una respuesta no valida');
                parseError.status = 502;
                throw parseError;
            }
        }

        if (!response.ok) {
            const detail = data?.detail || data?.message || 'Error al generar el borrador con IA';
            const serviceError = new Error(detail);
            serviceError.status = response.status >= 500 ? 502 : response.status;
            throw serviceError;
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            const validationError = new Error('El microservicio de IA devolvio un JSON invalido');
            validationError.status = 502;
            throw validationError;
        }

        return data;
    }
}

module.exports = new AIService();