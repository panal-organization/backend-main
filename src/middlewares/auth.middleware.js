const jwt = require('jsonwebtoken');
const { getJwtKeys } = require('../config/jwt-keys');

const { publicKey: PUB_KEY } = getJwtKeys();

module.exports = (req, res, next) => {
    // Check for authorization header
    const tokenParts = req.headers.authorization ? req.headers.authorization.split(' ') : [];

    if (tokenParts[0] === 'Bearer' && tokenParts[1].match(/\S+(\.\S+)+/)) {
        try {
            const verification = jwt.verify(tokenParts[1], PUB_KEY, { algorithms: ['RS256'] });
            req.jwt = verification;
            next();
        } catch (err) {
            res.status(401).json({ success: false, msg: "You are not authorized to visit this route" });
        }
    } else {
        res.status(401).json({ success: false, msg: "You are not authorized to visit this route" });
    }
};
