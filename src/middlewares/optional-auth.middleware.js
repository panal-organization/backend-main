const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const PUB_KEY = fs.readFileSync(path.join(__dirname, '../config/id_rsa_pub.pem'), 'utf8');

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