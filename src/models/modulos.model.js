const mongoose = require('mongoose');
const { Schema } = mongoose;

const ModulosSchema = new Schema({
    nombre: { type: String, required: true },
    ruta: { type: String, required: true },
    icono: { type: String },
    estatus: { type: Boolean, default: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('MODULOS', ModulosSchema);
