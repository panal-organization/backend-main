const mongoose = require('mongoose');
const { Schema } = mongoose;

const PlanSchema = new Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },

    descripcion: {
        type: String,
        trim: true
    },

    precio: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },

    moneda: {
        type: String,
        required: true,
        enum: ['USD', 'MXN', 'EUR'],
        default: 'USD'
    },

    tipoSuscripcion: {
        type: String,
        enum: ['mensual', 'anual'],
        default: 'mensual'
    },
    limiteUsuarios: {
        type: Number,
        required: true,
    },
    caracteristicas: [{
        type: String
    }],

    activo: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('PLAN', PlanSchema);