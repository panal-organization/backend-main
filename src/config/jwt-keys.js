const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const privateKeyPath = path.join(__dirname, 'id_rsa_priv.pem');
const publicKeyPath = path.join(__dirname, 'id_rsa_pub.pem');

function normalizeMultilineEnv(value) {
    return value ? value.replace(/\\n/g, '\n') : value;
}

function readKeysFromEnv() {
    const privateKey = normalizeMultilineEnv(process.env.JWT_PRIVATE_KEY);
    const publicKey = normalizeMultilineEnv(process.env.JWT_PUBLIC_KEY);

    if (privateKey && publicKey) {
        return { privateKey, publicKey };
    }

    return null;
}

function readKeysFromFiles() {
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
        return {
            privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
            publicKey: fs.readFileSync(publicKeyPath, 'utf8')
        };
    }

    return null;
}

function generateAndPersistKeys() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });

    fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
    fs.writeFileSync(publicKeyPath, publicKey, 'utf8');

    return { privateKey, publicKey };
}

function getJwtKeys() {
    const envKeys = readKeysFromEnv();
    if (envKeys) {
        return envKeys;
    }

    const fileKeys = readKeysFromFiles();
    if (fileKeys) {
        return fileKeys;
    }

    try {
        return generateAndPersistKeys();
    } catch (error) {
        throw new Error('JWT keys are missing and could not be generated automatically.');
    }
}

module.exports = {
    getJwtKeys
};
