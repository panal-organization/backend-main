const Archivo = require('../models/archivos.model');
const Usuario = require('../models/usuarios.model');

const uploadFile = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    try {
        const { usuario_id, tipo = 'otro' } = req.body;

        if (!usuario_id) {
            return res.status(400).json({ error: 'El ID del usuario es requerido para asociar el archivo' });
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        // 1. Guardar metadatos en la colección de ARCHIVOS
        const nuevoArchivo = new Archivo({
            nombre_original: req.file.originalname,
            nombre_servidor: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: fileUrl,
            usuario_id: usuario_id,
            tipo: tipo
        });

        await nuevoArchivo.save();

        // 2. Si el tipo es 'perfil', actualizar automáticamente la foto del usuario
        if (tipo === 'perfil') {
            await Usuario.findByIdAndUpdate(usuario_id, { foto: fileUrl });
        }

        res.json({
            message: tipo === 'perfil' ? 'Foto de perfil actualizada correctamente' : 'Archivo subido y asociado correctamente',
            archivo: nuevoArchivo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    uploadFile
};
