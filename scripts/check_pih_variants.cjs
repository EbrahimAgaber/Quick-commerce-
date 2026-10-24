/**
 * Investigation of ZATCA PIH Specification:
 * In ZATCA FATOORA documentation and UBL 2.1 schemas:
 * Field: /Invoice/cac:AdditionalDocumentReference[cbc:ID='PIH']/cac:Attachment/cac:ExternalReference/cbc:URI
 * ZATCA E-Invoicing Detailed Technical Guideline §4.2 & §5.3:
 * "The Previous Invoice Hash (PIH) for the first invoice is the SHA-256 hash of the character '0' (ASCII 48).
 * The hash value is represented in Base64 encoding."
 *
 * Notice:
 * If it is the SHA-256 of '0' in Base64:
 * 1. Raw 32 bytes base64 encoded:
 *    crypto.createHash('sha256').update('0').digest('base64')
 *    = "X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=" (44 characters, ending with 1 '=')
 *
 * 2. Hex string (64 characters) base64 encoded:
 *    Buffer.from(crypto.createHash('sha256').update('0').digest('hex'), 'utf8').toString('base64')
 *    = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==" (88 characters, ending with 2 '==')
 */

const crypto = require('crypto');

const rawHash = crypto.createHash('sha256').update('0', 'utf8').digest();
const hexHash = rawHash.toString('hex');

const b64Raw = rawHash.toString('base64');
const b64Hex = Buffer.from(hexHash, 'utf8').toString('base64');

console.log('Case 1: Base64 of 32 raw bytes:');
console.log(b64Raw);
console.log('Length:', b64Raw.length);

console.log('\nCase 2: Base64 of 64-char hex string:');
console.log(b64Hex);
console.log('Length:', b64Hex.length);

console.log('\nDoc 03 line 551 value:');
console.log('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjhhZTU4NDhmNmRkNTQ4Zg==');
console.log('Length:', 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjhhZTU4NDhmNmRkNTQ4Zg=='.length);
