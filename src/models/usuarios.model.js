const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

//Plan gratis: 69a3de4281a5be4cb1bd8bc0
//Plan pro: 69a3df3381a5be4cb1bd8bc3
//Plan pro anual: 69c221f4d6caef7a24b3e93d

const UsuariosSchema = new Schema({
    nombre: { type: String, required: true },
    correo: { type: String, required: true, unique: true },
    contrasena: { type: String, required: true, select: false },
    estatus: { type: Boolean, default: true },
    rol_id: { type: Schema.Types.ObjectId, ref: 'ROLES' },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' },
    plan_id: { type: Schema.Types.ObjectId, ref: 'PLAN', default: '69a3de4281a5be4cb1bd8bc0' },
    plan_inicio: { type: Date, default: null },
    plan_vence: { type: Date, default: null },
}, {
    timestamps: true,
    versionKey: false
});

// Pre-save hooks: handle password hashing and plan changes
UsuariosSchema.pre('save', async function () {
    // Hash password before saving if it's modified
    if (this.isModified('contrasena')) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.contrasena = await bcrypt.hash(this.contrasena, salt);
        } catch (err) {
            throw err;
        }
    }

    // Capture if plan_id changed to use in post-save hook
    if (this.isModified('plan_id')) {
        this._planChanged = true;
        const PLAN_GRATIS_ID = '69a3de4281a5be4cb1bd8bc0';

        if (this.plan_id.toString() === PLAN_GRATIS_ID) {
            this.plan_inicio = null;
            this.plan_vence = null;
        } else {
            this.plan_inicio = new Date();
            try {
                // Calculate plan_vence based on plan duration
                const Plan = mongoose.model('PLAN');
                const plan = await Plan.findById(this.plan_id);
                if (plan) {
                    const duration = plan.tipoSuscripcion === 'anual' ? 12 : 1;
                    const end = new Date(this.plan_inicio);
                    end.setMonth(end.getMonth() + duration);
                    this.plan_vence = end;
                }
            } catch (error) {
                console.error('Error calculating plan expiration:', error);
            }
        }
    }
});

// Sincronizar plan_id con sus workspaces si cambia
UsuariosSchema.post('save', async function (doc) {
    if (doc._planChanged) {
        await mongoose.model('WORKSPACES').updateMany(
            { admin_id: doc._id },
            { plan_id: doc.plan_id }
        );
    }
});

module.exports = mongoose.model('USUARIOS', UsuariosSchema);
