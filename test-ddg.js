const url = 'https://html.duckduckgo.com/html/?q=site:verdinha.wtf+"jogador"';

fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
})
  .then(res => res.text())
  .then(html => {
    const results = [];
    const regex = /<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match[1].includes('verdinha.wtf/manga/')) {
        results.push({
          url: match[1],
          title: match[2].replace(/<[^>]+>/g, '').trim(),
        });
      }
    }
    console.log(JSON.stringify(results, null, 2));
  });