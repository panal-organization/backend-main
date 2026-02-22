const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArticulosPropiedadesSchema = new Schema({
    articulo_id: { type: Schema.Types.ObjectId, ref: 'ARTICULOS', required: true },
    propiedad_id: { type: Schema.Types.ObjectId, ref: 'PROPIEDADES', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ARTICULOS_PROPIEDADES', ArticulosPropiedadesSchema);
