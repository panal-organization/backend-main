const mongoose = require('mongoose');
const { Schema } = mongoose;

const RoleSchema = new Schema({
    nombre: { type: String, required: true },
    codigo: { type: String, required: true, unique: true },
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ROLES', RoleSchema);
