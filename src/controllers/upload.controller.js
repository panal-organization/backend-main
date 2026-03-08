const fs = require('fs');
const path = require('path');
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

const deleteFile = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar el archivo en la base de datos
        const archivo = await Archivo.findById(id);

        if (!archivo) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        // Ruta del archivo en el sistema de archivos
        const filePath = path.join(__dirname, '../../uploads', archivo.nombre_servidor);

        // Eliminar del sistema de archivos usando fs
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Si era foto de perfil, quitar la foto del usuario
        if (archivo.tipo === 'perfil' && archivo.usuario_id) {
            await Usuario.findByIdAndUpdate(archivo.usuario_id, { foto: null });
        }

        // Eliminar el documento de la base de datos
        await Archivo.findByIdAndDelete(id);

        res.json({ message: 'Archivo eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateFile = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo nuevo' });
    }

    try {
        const { id } = req.params;
        const { tipo } = req.body;

        // Buscar el archivo anterior en la base de datos
        const archivoAnterior = await Archivo.findById(id);

        if (!archivoAnterior) {
            // Eliminar el archivo temporal recién subido
            const tempFilePath = path.join(__dirname, '../../uploads', req.file.filename);
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

            return res.status(404).json({ error: 'Archivo anterior no encontrado para actualizar' });
        }

        // Eliminar archivo anterior del sistema de archivos
        const oldFilePath = path.join(__dirname, '../../uploads', archivoAnterior.nombre_servidor);
        if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const nuevoTipo = tipo || archivoAnterior.tipo;

        // Actualizar los datos del archivo en la base de datos
        const archivoActualizado = await Archivo.findByIdAndUpdate(id, {
            nombre_original: req.file.originalname,
            nombre_servidor: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: fileUrl,
            tipo: nuevoTipo
        }, { new: true });

        // Si el tipo es perfil, actualizar la URL en el usuario
        if (nuevoTipo === 'perfil' && archivoActualizado.usuario_id) {
            await Usuario.findByIdAndUpdate(archivoActualizado.usuario_id, { foto: fileUrl });
        }

        res.json({
            message: 'Archivo actualizado correctamente',
            archivo: archivoActualizado
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    uploadFile,
    deleteFile,
    updateFile
};
