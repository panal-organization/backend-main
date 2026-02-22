const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArchivosSchema = new Schema({
    nombre_original: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'USUARIOS', required: true },
    tipo: { type: String, enum: ['perfil', 'documento', 'otro'], default: 'otro' }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ARCHIVOS', ArchivosSchema);
