const mongoose = require('mongoose');
const { Schema } = mongoose;

const TicketSchema = new Schema({
    descripcion: { type: String, required: true },
    estado_id: { type: Schema.Types.ObjectId, ref: 'ESTADO_TICKETS' },
    created_by: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },
    is_deleted: { type: Boolean, default: false },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

module.exports = mongoose.model('TICKETS', TicketSchema);
