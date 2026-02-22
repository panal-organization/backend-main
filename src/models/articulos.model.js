const mongoose = require('mongoose');
const { Schema } = mongoose;

const ArticuloSchema = new Schema({
    nombre: { type: String, required: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'WORKSPACES', required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('ARTICULOS', ArticuloSchema);
