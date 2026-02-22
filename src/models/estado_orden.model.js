const mongoose = require('mongoose');
const { Schema } = mongoose;

const EstadoOrdenSchema = new Schema({
    nombre: { type: String, required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ESTADO_ORDEN', EstadoOrdenSchema);
