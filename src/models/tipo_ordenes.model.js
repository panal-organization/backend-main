const mongoose = require('mongoose');
const { Schema } = mongoose;

const TipoOrdenSchema = new Schema({
    nombre: { type: String, required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('TIPO_ORDENES', TipoOrdenSchema);
