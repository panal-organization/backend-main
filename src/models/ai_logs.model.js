const mongoose = require('mongoose');
const { Schema } = mongoose;

const AILogSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS', required: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true },
    mode: { type: String, enum: ['jwt', 'demo'], required: true },
    source: { type: String, enum: ['agent', 'agent_plan', 'agent_policy', 'agent_plan_policy'], required: true },
    user_text: { type: String, required: true },
    intent: { type: String, required: true },
    confidence: { type: Number, default: null },
    requires_confirmation: { type: Boolean, default: false },
    steps: [{
        tool: { type: String, required: true },
        status: { type: String, required: true }
    }],
    preview_resumen: { type: Schema.Types.Mixed, default: null },
    executed: { type: Boolean, default: false },
    execution_result: { type: Schema.Types.Mixed, default: null }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

module.exports = mongoose.model('AI_LOGS', AILogSchema);
