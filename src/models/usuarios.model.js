const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UsuariosSchema = new Schema({
    nombre: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    contrasena: { type: String, required: true, select: false },
    estatus: { type: Boolean, default: true },
    rol_id: { type: Schema.Types.ObjectId, ref: 'ROLES' },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' }
}, {
    timestamps: true,
    versionKey: false
});

// Hash password before saving
UsuariosSchema.pre('save', async function () {
    if (!this.isModified('contrasena')) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.contrasena = await bcrypt.hash(this.contrasena, salt);
    } catch (err) {
        throw err;
    }
});

module.exports = mongoose.model('USUARIOS', UsuariosSchema);
