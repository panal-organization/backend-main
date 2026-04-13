const jwt = require('jsonwebtoken');
const { getJwtKeys } = require('../config/jwt-keys');

const { publicKey: PUB_KEY } = getJwtKeys();

module.exports = (req, _res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[0] === 'Bearer' ? tokenParts[1] : null;

    if (!token || !token.match(/\S+(\.\S+)+/)) {
        return next();
    }

    try {
        req.jwt = jwt.verify(token, PUB_KEY, { algorithms: ['RS256'] });
    } catch (error) {
        // Optional auth should not block demo flows; invalid token is treated as absent.
    }

    return next();
};