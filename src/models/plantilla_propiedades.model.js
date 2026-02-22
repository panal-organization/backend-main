const mongoose = require('mongoose');
const { Schema } = mongoose;

const PlantillaPropiedadesSchema = new Schema({
    plantilla_id: { type: Schema.Types.ObjectId, ref: 'PLANTILLAS', required: true },
    propiedad_id: { type: Schema.Types.ObjectId, ref: 'PROPIEDADES', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('PLANTILLA_PROPIEDADES', PlantillaPropiedadesSchema);
