const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlmacenSchema = new Schema({
    nombre: { type: String, required: true },
    icono: { type: String },
    registros: { type: Number, default: 0 },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ALMACEN', AlmacenSchema);
