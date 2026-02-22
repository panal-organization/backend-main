const AuthService = require('../services/auth.service');

class AuthController {
    async signUp(req, res) {
        try {
            const { user, token } = await AuthService.signUp(req.body);
            res.status(201).json({ user, token });
        } catch (error) {
            res.status(error.status || 500).json({ message: error.message });
        }
    }

    async signIn(req, res) {
        try {
            const { correo, contrasena } = req.body;
            const result = await AuthService.signIn(correo, contrasena);
            res.status(200).json(result);
        } catch (error) {
            res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new AuthController();
