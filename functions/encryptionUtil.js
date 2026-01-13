import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY

export function encrypt(plaintext) {
    try {
        return CryptoJS.AES.encrypt(plaintext, SECRET_KEY).toString();
    } catch (error) {
        console.error('Encryption error:', error);
        return '';
    }
}

export function decrypt(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Decryption error:', error);
        return '';
    }
}