const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const PRIVATE_KEY_PATH = path.join(__dirname, "src", "config", "id_rsa_priv.pem");
const SUBJECT_USER_ID = "699d2f62b00a373767e0adc1";

function loadPrivateKey(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`No se encontro la clave privada en: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf8");
}

function generateToken(privateKey) {
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
        {
            sub: SUBJECT_USER_ID,
            iat: now
        },
        privateKey,
        {
            algorithm: "RS256",
            expiresIn: "1d"
        }
    );
}

function main() {
    try {
        const privateKey = loadPrivateKey(PRIVATE_KEY_PATH);
        const token = generateToken(privateKey);

        console.log("JWT generado (RS256):");
        console.log(token);
        console.log("\nHeader listo para usar:");
        console.log(`Bearer ${token}`);
    } catch (error) {
        console.error("Error generando JWT:");
        console.error(error.message);
        process.exit(1);
    }
}

main();
