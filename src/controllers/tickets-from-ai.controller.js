const { TicketsFromAIService } = require('../services');

class TicketsFromAIController {
    async createFromAIDraft(req, res) {
        try {
            const { ai_log_id: aiLogId, ...draftPayload } = req.body || {};
            const ticket = await TicketsFromAIService.createFromDraft({
                draft: draftPayload,
                jwtUserId: req.jwt?.sub,
                aiLogId
            });

            return res.status(201).json(ticket);
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new TicketsFromAIController();