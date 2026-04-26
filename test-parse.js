const url = 'https://verdinha.wtf/?s=o+jogador';

fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
})
  .then(res => res.text())
  .then(html => {
    const fs = require('fs');
    fs.writeFileSync('verdinha2.html', html);
    console.log('Saved length:', html.length);
  });