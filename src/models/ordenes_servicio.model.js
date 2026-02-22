const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrdenServicioSchema = new Schema({
    descripcion: { type: String, required: true },
    estado_id: { type: Schema.Types.ObjectId, ref: 'ESTADO_ORDEN' },
    created_by: { type: Schema.Types.ObjectId, ref: 'USUARIOS' },
    articulo_id: { type: Schema.Types.ObjectId, ref: 'ARTICULOS' },
    tipo_id: { type: Schema.Types.ObjectId, ref: 'TIPO_ORDENES' },
    is_deleted: { type: Boolean, default: false },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
});

module.exports = mongoose.model('ORDENES_SERVICIO', OrdenServicioSchema);
