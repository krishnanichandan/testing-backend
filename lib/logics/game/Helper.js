"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptData = void 0;
const crypto = __importStar(require("crypto"));
function decryptData(encryptedData) {
    const secretKey = 'yrRASADbDTsF3gYRadDHCOdGOdOOVfC9'; //make it configurable From ENV
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
    return decryptedData;
}
exports.decryptData = decryptData;
