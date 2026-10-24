import https from 'https';

const API_KEY = '4bf98a0d7e63459c9b1f2e8d3a5c71b0';
const HOST = 'quick-ecommerce-saas-app.web.app';
const KEY_LOCATION = `https://${HOST}/${API_KEY}.txt`;

const URLS = [
  `https://${HOST}/`,
  `https://${HOST}/?store=simpler`,
  `https://${HOST}/?store=aurora`,
];

const payload = JSON.stringify({
  host: HOST,
  key: API_KEY,
  keyLocation: KEY_LOCATION,
  urlList: URLS,
});

console.log(`[IndexNow] Submitting ${URLS.length} URLs to Microsoft Bing IndexNow API...`);

const req = https.request(
  'https://api.indexnow.org/indexnow',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    if (res.statusCode === 200 || res.statusCode === 202) {
      console.log(`[IndexNow] Success! Status Code: ${res.statusCode} (URLs accepted for indexing by Bing & partners).`);
    } else {
      console.warn(`[IndexNow] Response Status: ${res.statusCode}`);
    }
    res.on('data', (chunk) => process.stdout.write(chunk));
  }
);

req.on('error', (err) => {
  console.error('[IndexNow] Error submitting to IndexNow:', err);
});

req.write(payload);
req.end();
