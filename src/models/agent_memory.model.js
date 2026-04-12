const mongoose = require('mongoose');
const { Schema } = mongoose;

const AgentMemoryEntrySchema = new Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    intent: {
        type: String,
        default: null
    },
    result_summary: {
        type: String,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    _id: false
});

const AgentMemorySchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS', required: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true },
    session_id: { type: String, required: true },
    entries: {
        type: [AgentMemoryEntrySchema],
        default: []
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

AgentMemorySchema.index({ user_id: 1, workspace_id: 1, session_id: 1 }, { unique: true });

module.exports = mongoose.model('AGENT_MEMORY', AgentMemorySchema);
