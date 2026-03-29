const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArticuloSchema = new Schema({
    foto: { type: String, default: null },
    nombre: { type: String, required: true },
    descripcion: { type: String, default: null },
    almacen_id: { type: Schema.Types.ObjectId, ref: 'ALMACEN' },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true },
    estatus: { type: Boolean, default: true },
    stock_actual: { type: Number, required: true, default: 0, min: 0 },
    stock_minimo: { type: Number, required: true, default: 0, min: 0 },
    unidad: { type: String, required: true, default: 'unidad' },
    stock_maximo: {
        type: Number,
        default: null,
        validate: {
            validator(value) {
                if (value === null || value === undefined) {
                    return true;
                }

                if (value < 0) {
                    return false;
                }

                return value >= (this.stock_minimo ?? 0);
            },
            message: 'stock_maximo debe ser mayor o igual a stock_minimo'
        }
    },
    alerta_activa: { type: Boolean, default: false }
}, {
    timestamps: true,
    versionKey: false
});

const Articulo = mongoose.model('ARTICULOS', ArticuloSchema);

// Función para actualizar el contador de registros en el almacén
const updateAlmacenCount = async (almacen_id) => {
    if (!almacen_id) return;
    const Almacen = mongoose.model('ALMACEN');
    const count = await mongoose.model('ARTICULOS').countDocuments({ 
        almacen_id, 
        estatus: true 
    });
    await Almacen.findByIdAndUpdate(almacen_id, { registros: count });
};

// Hook antes de guardar para capturar el almacén anterior si cambia
ArticuloSchema.pre('save', async function(next) {
    if (!this.isNew && this.isModified('almacen_id')) {
        const oldDoc = await mongoose.model('ARTICULOS').findById(this._id);
        if (oldDoc) {
            this._oldAlmacenId = oldDoc.almacen_id;
        }
    }
    next();
});

// Hook después de guardar (create/update)
ArticuloSchema.post('save', async function(doc) {
    await updateAlmacenCount(doc.almacen_id);
    if (this._oldAlmacenId && this._oldAlmacenId.toString() !== doc.almacen_id?.toString()) {
        await updateAlmacenCount(this._oldAlmacenId);
    }
});

// Hook después de eliminar
ArticuloSchema.post('findOneAndDelete', async function(doc) {
    if (doc && doc.almacen_id) {
        await updateAlmacenCount(doc.almacen_id);
    }
});

module.exports = Articulo;
