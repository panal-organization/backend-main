const mongoose = require('mongoose');
const { Schema } = mongoose;

const WorkspacesUsuariosSchema = new Schema({
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('WORKSPACES_USUARIOS', WorkspacesUsuariosSchema);
