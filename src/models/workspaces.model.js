const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspaceSchema = new Schema({
    nombre: { type: String, required: true },
    admin_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },
    is_deleted: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false
});

module.exports = mongoose.model('WORKSPACES', WorkspaceSchema);
