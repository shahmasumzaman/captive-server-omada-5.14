// utils/cryptoUtils.js
import crypto from "crypto";

/**
 * Encrypts data using AES-128-CBC with a random key and IV, then RSA encrypts the key/IV.
 * @param {Buffer} dataBuffer - The data to encrypt.
 * @param {string} publicKeyPem - RSA Public Key in PEM format.
 * @returns {{encryptedKey: string, encryptedData: string}} - Encrypted AES key (RSA encrypted, URL-safe base64) and AES encrypted data (base64).
 */
export function rsaAesEncrypt(dataBuffer, publicKeyPem) {
    const aesKey = crypto.randomBytes(16); // 128-bit key
    const aesIv = crypto.randomBytes(16); // 128-bit IV

    const cipher = crypto.createCipheriv("aes-128-cbc", aesKey, aesIv);
    let encryptedData = cipher.update(dataBuffer);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);

    const keyIvBuffer = Buffer.concat([aesKey, aesIv]);
    const encryptedKeyBuffer = crypto.publicEncrypt(
        {
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        keyIvBuffer
    );

    const encryptedKey = encryptedKeyBuffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    return {
        encryptedKey: encryptedKey,
        encryptedData: encryptedData.toString("base64"),
    };
}

// Add other crypto utilities if needed