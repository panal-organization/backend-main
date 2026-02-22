const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        }
    });

    // Write keys to files
    const keyDir = path.join(__dirname, '../src/config');

    if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true });
    }

    fs.writeFileSync(path.join(keyDir, 'id_rsa_pub.pem'), publicKey);
    fs.writeFileSync(path.join(keyDir, 'id_rsa_priv.pem'), privateKey);

    console.log('Keys generated successfully in src/config/');
}

generateKeyPair();
