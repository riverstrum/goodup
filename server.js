const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8420;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ARTICLES_PATH = path.join(ROOT, 'data', 'articles.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

function loadArticles() {
  const raw = fs.readFileSync(ARTICLES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60'
  });
  res.end(body);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sendRSS(res, articles, baseUrl) {
  const items = articles.map(a => {
    const imageHtml = a.image ? `<p><img src="${escapeXml(a.image)}" /></p>` : '';
    return `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.source_url)}</link>
      <guid isPermaLink="false">goodup-${a.id}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <source url="${escapeXml(a.source_url)}">${escapeXml(a.source)}</source>
      <description>${escapeXml(a.dek)}</description>
      <content:encoded><![CDATA[${imageHtml}<p>${a.dek}</p><p>Curated by THE GOOD UP. Read the full story at <a href="${a.source_url}">${a.source}</a>.</p>]]></content:encoded>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>THE GOOD UP</title>
    <link>${baseUrl}</link>
    <description>Start your day with something good. Curated breakthroughs in science and politics, free to read and free to republish.</description>
    <language>en-us</language>
    <docs>${baseUrl}/api/docs</docs>
    ${items}
  </channel>
</rss>`;

  res.writeHead(200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60'
  });
  res.end(xml);
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const baseUrl = `http://${req.headers.host}`;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // GET /api/articles?category=&limit=&q=
  if (pathname === '/api/articles' && req.method === 'GET') {
    let articles = loadArticles();
    const { category, limit, q, featured } = parsed.query;

    if (category) {
      articles = articles.filter(
        a => a.category.toLowerCase() === String(category).toLowerCase()
      );
    }
    if (featured === 'true') {
      articles = articles.filter(a => a.featured);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      articles = articles.filter(
        a => a.title.toLowerCase().includes(needle) || a.dek.toLowerCase().includes(needle)
      );
    }
    articles = articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (limit) {
      articles = articles.slice(0, parseInt(limit, 10) || articles.length);
    }

    sendJSON(res, 200, {
      curator: 'THE GOOD UP',
      license: 'Curation free to republish with attribution to THE GOOD UP and the original source. See /api/docs for terms.',
      count: articles.length,
      articles
    });
    return;
  }

  // GET /api/articles/:slug
  if (pathname.startsWith('/api/articles/') && req.method === 'GET') {
    const slug = decodeURIComponent(pathname.replace('/api/articles/', ''));
    const articles = loadArticles();
    const article = articles.find(a => a.slug === slug || String(a.id) === slug);
    if (!article) {
      sendJSON(res, 404, { error: 'Article not found' });
      return;
    }
    sendJSON(res, 200, {
      curator: 'THE GOOD UP',
      license: 'Curation free to republish with attribution to THE GOOD UP and the original source. See /api/docs for terms.',
      article
    });
    return;
  }

  // GET /api/categories
  if (pathname === '/api/categories' && req.method === 'GET') {
    const articles = loadArticles();
    const categories = [...new Set(articles.map(a => a.category))].sort();
    sendJSON(res, 200, { categories });
    return;
  }

  // GET /api/rss.xml
  if ((pathname === '/api/rss.xml' || pathname === '/rss.xml') && req.method === 'GET') {
    const articles = loadArticles().sort((a, b) => new Date(b.date) - new Date(a.date));
    sendRSS(res, articles, baseUrl);
    return;
  }

  // GET /api/docs - machine-readable summary of the API for integrators
  if (pathname === '/api/docs' && req.method === 'GET') {
    sendJSON(res, 200, {
      name: 'THE GOOD UP API',
      version: '1.0',
      description: 'Public read-only API for curated science and politics breakthroughs, sourced from Good News Network, Optimist Daily, Positive News, and Good Good Good. No API key, no paywall, no rate limit beyond fair use.',
      license: {
        summary: 'Our curation (headlines, summaries, categorization, images) is free to reuse and republish anywhere, on any site or app. Full articles belong to the original publishers, not us — every entry includes a source_url pointing to the original reporting.',
        attribution: 'Credit "THE GOOD UP" for the curation, and credit/link the original source (the "source" and "source_url" fields) for the story itself.'
      },
      endpoints: [
        { path: '/api/articles', method: 'GET', query: ['category', 'featured', 'q', 'limit'], description: 'List curated articles, newest first.' },
        { path: '/api/articles/:slug', method: 'GET', description: 'Get a single curated article by slug or id.' },
        { path: '/api/categories', method: 'GET', description: 'List all categories.' },
        { path: '/api/rss.xml', method: 'GET', description: 'Full RSS 2.0 feed for syndication.' }
      ]
    });
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`THE GOOD UP is running at http://localhost:${PORT}`);
  console.log(`API docs:   http://localhost:${PORT}/api/docs`);
  console.log(`RSS feed:   http://localhost:${PORT}/api/rss.xml`);
});
