const mongoose = require('mongoose');
const AILogs = require('../models/ai_logs.model');

class AILogsService {
    async createLog(payload) {
        return AILogs.create(payload);
    }

    async markExecuted({ logId, userId, workspaceId, executionResult }) {
        if (!logId) {
            return null;
        }

        if (!mongoose.Types.ObjectId.isValid(logId)) {
            const error = new Error('ai_log_id invalido');
            error.status = 400;
            throw error;
        }

        const updated = await AILogs.findOneAndUpdate(
            {
                _id: logId,
                user_id: userId,
                workspace_id: workspaceId
            },
            {
                $set: {
                    executed: true,
                    execution_result: executionResult || null
                }
            },
            { new: true }
        );

        if (!updated) {
            const error = new Error('No se encontro el log de IA para actualizar');
            error.status = 404;
            throw error;
        }

        return updated;
    }
}

module.exports = new AILogsService();
