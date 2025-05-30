import CryptoJS from 'crypto-js';

const SECRET_KEY = '1234'; //Placeholder

export function encrypt(plaintext) {
    try {
        const ciphertext = CryptoJS.AES.encrypt(plaintext, SECRET_KEY).toString();
        return ciphertext;
    } catch (error) {
        return '';
    }
}

export function decrypt(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        return plaintext;
    } catch (error) {
        return ''; 
    }
}