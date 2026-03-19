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