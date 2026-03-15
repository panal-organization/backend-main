const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');

const WorkspaceSchema = new Schema({
    nombre: { type: String, required: true },
    codigo: { 
        type: String, 
        unique: true, 
        default: () => crypto.randomBytes(4).toString('hex')
    },
    admin_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },
    is_deleted: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false
});

// Hook para crear automáticamente la relación con el admin al crear el workspace
WorkspaceSchema.post('save', async function(doc) {
    if (doc.admin_id) {
        const WorkspacesUsuarios = mongoose.model('WORKSPACES_USUARIOS');
        const existing = await WorkspacesUsuarios.findOne({
            workspace_id: doc._id,
            usuario_id: doc.admin_id
        });
        
        if (!existing) {
            await WorkspacesUsuarios.create({
                workspace_id: doc._id,
                usuario_id: doc.admin_id
            });
        }
    }
});

module.exports = mongoose.model('WORKSPACES', WorkspaceSchema);
