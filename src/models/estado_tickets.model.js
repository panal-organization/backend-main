const mongoose = require('mongoose');
const { Schema } = mongoose;

const EstadoTicketSchema = new Schema({
    nombre: { type: String, required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ESTADO_TICKETS', EstadoTicketSchema);
