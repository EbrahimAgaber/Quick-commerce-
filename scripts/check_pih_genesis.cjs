const crypto = require('crypto');

const b64 = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjhhZTU4NDhmNmRkNTQ4Zg==';
const decodedHex = Buffer.from(b64, 'base64').toString('utf8');
console.log('Decoded hex string from Doc 03 line 551:');
console.log(decodedHex);

const realHash = crypto.createHash('sha256').update('0', 'utf8').digest('hex');
console.log('Real SHA-256("0") hex:');
console.log(realHash);

console.log('Exact match?', decodedHex === realHash);

// Let's check character by character comparison:
let diffs = [];
for (let i = 0; i < Math.max(decodedHex.length, realHash.length); i++) {
  if (decodedHex[i] !== realHash[i]) {
    diffs.push({ index: i, doc03: decodedHex[i], real: realHash[i] });
  }
}
console.log('Character differences count:', diffs.length);
console.log('Differences details:', JSON.stringify(diffs));

// What about SHA-256 of empty string?
console.log('SHA-256("") hex:', crypto.createHash('sha256').update('', 'utf8').digest('hex'));
// What about SHA-256 of 0x00?
console.log('SHA-256(0x00) hex:', crypto.createHash('sha256').update(Buffer.from([0x00])).digest('hex'));
// What about SHA-256 of "0\n"?
console.log('SHA-256("0\\n") hex:', crypto.createHash('sha256').update('0\n', 'utf8').digest('hex'));
