import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';

async function decryptData(encryptedData: string) {
    const secretKey = 'yrRASADbDTsF3gYRadDHCOdGOdOOVfC9'


//     const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), ivKy);
const iv = Buffer.alloc(16); // Create a buffer of 16 bytes
const ivPart1 = Buffer.from('GOdOSyrRAdGO3SAD', 'utf8'); // First 16 bytes of the IV
const ivPart2 = Buffer.from('32ByteIV32ByteIV', 'utf8').slice(0, 16); // Next 16 bytes of the IV

// Copy the contents of ivPart1 and ivPart2 into the iv buffer
ivPart1.copy(iv, 0, 0, 16);
ivPart2.copy(iv, 16, 0, 16);

// Create decipher object with the 32-byte IV
const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
    let decryptedData = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    console.log('Decrypted data:', decryptedData);
    return decryptedData;
}

// Example encrypted data received from Ivoree CMS (replace with actual encrypted data)

export { decryptData };


