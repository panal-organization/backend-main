const mongoose = require('mongoose');
const AILogs = require('../models/ai_logs.model');

class AILogsService {
    async createLog(payload) {
        return AILogs.create(payload);
    }

    async getLogById({ logId }) {
        if (!logId || !mongoose.Types.ObjectId.isValid(logId)) {
            return null;
        }

        return AILogs.findById(logId);
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

    async markPlanStepCompleted({ logId, userId, workspaceId, tool, executionResult }) {
        if (!logId) {
            return null;
        }

        if (!mongoose.Types.ObjectId.isValid(logId)) {
            const error = new Error('ai_log_id invalido');
            error.status = 400;
            throw error;
        }

        const log = await AILogs.findOne({
            _id: logId,
            user_id: userId,
            workspace_id: workspaceId
        });

        if (!log) {
            const error = new Error('No se encontro el log de IA para actualizar');
            error.status = 404;
            throw error;
        }

        let hasMatchingStep = false;
        const updatedSteps = Array.isArray(log.steps)
            ? log.steps.map((step) => {
                if (!step || step.tool !== tool) {
                    return step;
                }

                hasMatchingStep = true;

                return {
                    tool: step.tool,
                    status: 'completed'
                };
            })
            : [];

        const pendingOrBlocking = hasMatchingStep
            ? updatedSteps.some((step) => (
                step.status !== 'completed' && step.status !== 'skipped'
            ))
            : false;

        log.steps = updatedSteps;
        log.executed = !pendingOrBlocking;
        log.execution_result = executionResult || null;
        await log.save();

        return log;
    }

    async updatePlanState({
        logId,
        userId,
        workspaceId,
        steps,
        requiresConfirmation,
        previewResumen,
        executed,
        executionResult
    }) {
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
                    steps: Array.isArray(steps) ? steps : [],
                    requires_confirmation: Boolean(requiresConfirmation),
                    preview_resumen: previewResumen || null,
                    executed: Boolean(executed),
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
