import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.REACT_APP_ENCRYPTION_SECRET_KEY;

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
        //console.log("ciphertext:", ciphertext);
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        //console.log("bytes:", bytes);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        //console.log("plaintext:", plaintext);
        return plaintext;
    } catch (error) {
        console.error('Decryption error', error);
        return ''; 
    }
}

