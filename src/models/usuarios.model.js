const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

//Plan gratis: 69a3de4281a5be4cb1bd8bc0
//Plan pro: 69a3df3381a5be4cb1bd8bc3

const UsuariosSchema = new Schema({
    nombre: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    contrasena: { type: String, required: true, select: false },
    estatus: { type: Boolean, default: true },
    rol_id: { type: Schema.Types.ObjectId, ref: 'ROLES' },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' },
    plan_id: { type: Schema.Types.ObjectId, ref: 'PLANES', default: '69a3de4281a5be4cb1bd8bc0' },
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

// Sincronizar plan_id con sus workspaces si cambia
UsuariosSchema.post('save', async function (doc) {
    if (this._planChanged) {
        await mongoose.model('WORKSPACES').updateMany(
            { admin_id: doc._id },
            { plan_id: doc.plan_id }
        );
    }
});

// Cargar estado previo antes de guardar
UsuariosSchema.pre('save', function (next) {
    if (this.isModified('plan_id')) {
        this._planChanged = true;
    }
    next();
});

module.exports = mongoose.model('USUARIOS', UsuariosSchema);
