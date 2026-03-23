const AgentMemory = require('../models/agent_memory.model');

const MAX_MEMORY_ENTRIES = 5;
const MAX_TEXT_LENGTH = 280;

class AgentMemoryService {
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
