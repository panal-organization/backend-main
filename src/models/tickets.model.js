const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketSchema = new Schema({
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    foto: { type: String, default: null },

    estado: {
        type: String,
        enum: ['PENDIENTE', 'EN_PROGRESO', 'RESUELTO'],
        default: 'PENDIENTE'
    },

    prioridad: {
        type: String,
        enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
        default: 'MEDIA'
    },

    categoria: {
        type: String,
        enum: ['BUG', 'SOPORTE', 'MEJORA', 'MANTENIMIENTO'],
        default: 'SOPORTE'
    },

    created_by: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },

    comentarios: [{
        usuario: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },
        comentario: String,
        fecha: { type: Date, default: Date.now }
    }],

    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES' },

    is_deleted: { type: Boolean, default: false }

}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

module.exports = mongoose.model('TICKETS', TicketSchema);
