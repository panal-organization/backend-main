const mongoose = require('mongoose');
const { Schema } = mongoose;

const PropiedadSchema = new Schema({
    nombre: { type: String, required: true },
    descripcion: { type: String },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('PROPIEDADES', PropiedadSchema);
