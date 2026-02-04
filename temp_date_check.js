const https = require('https');

const id = "o5aT_IRUZQw";
const url = `https://www.youtube.com/watch?v=${id}`;

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // Look for datePublished
        const match = data.match(/itemprop="datePublished" content="([^"]+)"/);
        if (match) {
            console.log("FOUND_DATE:", match[1]);
        } else {
            // Falback try: "dateText":{"simpleText":"..."}
            const match2 = data.match(/"dateText":{"simpleText":"([^"]+)"}/);
            if (match2) {
                console.log("FOUND_DATE_TEXT:", match2[1]);
            } else {
                console.log("No date found. Status:", res.statusCode);
            }
        }
    });
}).on('error', (e) => {
    console.error(e);
});
