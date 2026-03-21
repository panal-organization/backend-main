const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArticuloSchema = new Schema({
    foto: { type: String, default: null },
    nombre: { type: String, required: true },
    descripcion: { type: String, default: null },
    almacen_id: { type: Schema.Types.ObjectId, ref: 'ALMACEN' },
    estatus: { type: Boolean, default: true }
}, {
    timestamps: true,
    versionKey: false
});

// Recuenta los artículos activos de un almacén y actualiza su campo "registros"
const updateAlmacenCount = async (almacen_id) => {
    if (!almacen_id) return;
    const Almacen = mongoose.model('ALMACEN');
    const count = await mongoose.model('ARTICULOS').countDocuments({
        almacen_id,
        estatus: true
    });
    await Almacen.findByIdAndUpdate(almacen_id, { registros: count });
};

// Antes de guardar: captura el estado anterior si cambia almacen_id o estatus
ArticuloSchema.pre('save', async function (next) {
    if (!this.isNew && (this.isModified('almacen_id') || this.isModified('estatus'))) {
        const oldDoc = await mongoose.model('ARTICULOS').findById(this._id);
        if (oldDoc) {
            this._oldAlmacenId = oldDoc.almacen_id;
        }
    }
    next();
});

// Después de guardar (create / update)
ArticuloSchema.post('save', async function (doc) {
    // Siempre actualizar el almacén actual del artículo
    await updateAlmacenCount(doc.almacen_id);

    // Si cambió de almacén, actualizar también el almacén anterior
    if (this._oldAlmacenId && this._oldAlmacenId.toString() !== doc.almacen_id?.toString()) {
        await updateAlmacenCount(this._oldAlmacenId);
    }
});

// Después de eliminar
ArticuloSchema.post('findOneAndDelete', async function (doc) {
    if (doc && doc.almacen_id) {
        await updateAlmacenCount(doc.almacen_id);
    }
});

const Articulo = mongoose.model('ARTICULOS', ArticuloSchema);

module.exports = Articulo;
