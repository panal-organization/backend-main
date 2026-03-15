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
    plan_id: { type: Schema.Types.ObjectId, ref: 'PLAN' },
    is_deleted: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false
});

// Hook para crear automáticamente la relación con el admin al crear el workspace
WorkspaceSchema.post('save', async function(doc) {
    if (doc.admin_id) {
        // 1. Crear relación en WORKSPACES_USUARIOS
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

        // 2. Si es nuevo, asegurar que heredó el plan_id del admin
        if (!doc.plan_id) {
            const Usuario = mongoose.model('USUARIOS');
            const admin = await Usuario.findById(doc.admin_id);
            if (admin && admin.plan_id) {
                await mongoose.model('WORKSPACES').findByIdAndUpdate(doc._id, { plan_id: admin.plan_id });
            }
        }
    }
});

module.exports = mongoose.model('WORKSPACES', WorkspaceSchema);
