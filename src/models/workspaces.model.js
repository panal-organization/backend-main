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

module.exports = mongoose.model('WORKSPACES', WorkspaceSchema);
