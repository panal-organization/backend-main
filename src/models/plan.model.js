const mongoose = require('mongoose');
const { Schema } = mongoose;

const PlanSchema = new Schema({
    nombre: { type: String, required: true },
    descripcion: { type: String }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('PLAN', PlanSchema);
