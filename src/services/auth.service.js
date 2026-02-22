const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Usuarios = require('../models/usuarios.model');

const PRIV_KEY = fs.readFileSync(path.join(__dirname, '../config/id_rsa_priv.pem'), 'utf8');
const PUB_KEY = fs.readFileSync(path.join(__dirname, '../config/id_rsa_pub.pem'), 'utf8');

class AuthService {
    async signUp(userData) {
        // Validation could be added here
        const existingUser = await Usuarios.findOne({ correo: userData.correo });

        if (existingUser) {
            const error = new Error('El usuario ya existe');
            error.status = 400;
            throw error;
        }

        const newUser = new Usuarios(userData);
        await newUser.save();

        // Return sanitized user
        const userResponse = {
            _id: newUser._id,
            nombre: newUser.nombre,
            correo: newUser.correo,
            rol_id: newUser.rol_id,
            estatus: newUser.estatus,
            foto: newUser.foto
        };

        // Optionally generate token here or just return user
        const token = this.issueToken(newUser);

        return { user: userResponse, token };
    }

    async signIn(correo, contrasena) {
        const user = await Usuarios.findOne({ correo }).select('+contrasena');

        if (!user) {
            const error = new Error('Credenciales invalidas');
            error.status = 401;
            throw error;
        }

        const isMatch = await bcrypt.compare(contrasena, user.contrasena);

        if (!isMatch) {
            const error = new Error('Credenciales invalidas');
            error.status = 401;
            throw error;
        }

        const token = this.issueToken(user);

        return {
            user: {
                _id: user._id,
                nombre: user.nombre,
                correo: user.correo,
                rol_id: user.rol_id,
                estatus: user.estatus,
                foto: user.foto
            },
            token: token,
            expiresIn: '1d' // Or whatever you set for expiresIn
        };
    }

    issueToken(user) {
        const _id = user._id;
        const expiresIn = '1d';

        const payload = {
            sub: _id,
            iat: Date.now()
        };

        const signedToken = jwt.sign(payload, PRIV_KEY, { expiresIn: expiresIn, algorithm: 'RS256' });

        return {
            token: "Bearer " + signedToken,
            expires: expiresIn
        };
    }
}

module.exports = new AuthService();
