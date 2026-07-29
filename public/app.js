const app = document.getElementById('app');
const navInner = document.getElementById('navbar-inner');

let ARTICLES = [];
let CATEGORIES = [];

async function loadData() {
  const [articlesRes, catRes] = await Promise.all([
    fetch('/api/articles'),
    fetch('/api/categories')
  ]);
  const articlesJson = await articlesRes.json();
  const catJson = await catRes.json();
  ARTICLES = articlesJson.articles;
  CATEGORIES = catJson.categories;
  buildNav();
  route();
}

function buildNav() {
  navInner.innerHTML = '<a href="#/" class="navbar__link" data-cat="">HOME</a>' +
    CATEGORIES.map(c => `<a href="#/category/${encodeURIComponent(c)}" class="navbar__link" data-cat="${c}">${c.toUpperCase()}</a>`).join('');
}

function markActiveNav(cat) {
  document.querySelectorAll('.navbar__link').forEach(el => {
    el.classList.toggle('navbar__link--active', (el.dataset.cat || '') === (cat || ''));
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function findArticle(slug) {
  return ARTICLES.find(a => a.slug === slug);
}

function artBlock(a, className) {
  if (!a.image) return '';
  return `<div class="${className}"><img src="${a.image}" alt="" loading="lazy" onerror="this.closest('.${className}').remove()"></div>`;
}

function renderHome() {
  markActiveNav('');
  const featured = ARTICLES.find(a => a.featured) || ARTICLES[0];
  const rest = ARTICLES.filter(a => a.id !== featured.id);
  const secondary = rest.slice(0, 4);
  const trending = ARTICLES.slice(0, 5);

  app.innerHTML = `
    <div class="home-grid">
      <div>
        <div class="lead-story" data-slug="${featured.slug}">
          ${artBlock(featured, 'lead-story__art')}
          <span class="lead-story__cat">${featured.category.toUpperCase()}</span>
          <h1 class="lead-story__title">${escapeHtml(featured.title)}</h1>
          <p class="lead-story__dek">${escapeHtml(featured.dek)}</p>
          <div class="byline">Via ${escapeHtml(featured.source)} &middot; ${formatDate(featured.date)}</div>
        </div>
        <div class="section-label">MORE BREAKTHROUGHS</div>
        ${secondary.map(storyRow).join('')}
      </div>
      <aside class="sidebar">
        <div class="sidebar__title">TRENDING BREAKTHROUGHS</div>
        ${trending.map((a, i) => `
          <div class="trend-item" data-slug="${a.slug}">
            <div class="trend-item__num">${i + 1}</div>
            <div class="trend-item__title">${escapeHtml(a.title)}</div>
          </div>
        `).join('')}
        <div class="sidebar-cta">
          Want this curation on your site? <a href="#/develop">Republish it free &rarr;</a>
        </div>
      </aside>
    </div>
  `;
  attachClickHandlers();
}

function storyRow(a) {
  return `
    <div class="story-row" data-slug="${a.slug}">
      ${artBlock(a, 'story-row__art')}
      <div class="story-row__body">
        <div class="story-row__cat">${a.category.toUpperCase()}</div>
        <h3 class="story-row__title">${escapeHtml(a.title)}</h3>
        <div class="byline">Via ${escapeHtml(a.source)} &middot; ${formatDate(a.date)}</div>
      </div>
    </div>
  `;
}

function renderCategory(cat) {
  markActiveNav(cat);
  const items = ARTICLES.filter(a => a.category.toLowerCase() === cat.toLowerCase());
  app.innerHTML = `
    <div class="section-label">${cat.toUpperCase()}</div>
    ${items.length ? `<div class="card-grid">${items.map(cardTemplate).join('')}</div>` : `<div class="empty-state">No stories in this category yet &mdash; check back soon.</div>`}
  `;
  attachClickHandlers();
}

function cardTemplate(a) {
  return `
    <div class="card" data-slug="${a.slug}">
      ${artBlock(a, 'card__art')}
      <div class="card__body">
        <div class="card__cat">${a.category.toUpperCase()}</div>
        <h3 class="card__title">${escapeHtml(a.title)}</h3>
        <div class="byline">${formatDate(a.date)}</div>
      </div>
    </div>
  `;
}

function renderArticle(slug) {
  const a = findArticle(slug);
  if (!a) {
    app.innerHTML = `<div class="empty-state">Story not found.</div>`;
    return;
  }
  markActiveNav(a.category);
  const origin = window.location.origin;
  const embedSnippet = `<blockquote data-goodup-article="${a.slug}"></blockquote>\n<script src="${origin}/embed.js" async><\/script>`;

  app.innerHTML = `
    <div class="article">
      <a href="#/" class="article__back">&larr; BACK TO THE GOOD UP</a>
      <span class="article__cat">${a.category.toUpperCase()}</span>
      <h1 class="article__title">${escapeHtml(a.title)}</h1>
      <p class="article__dek">${escapeHtml(a.dek)}</p>
      <div class="article__meta">Via <strong>${escapeHtml(a.source)}</strong> &middot; ${formatDate(a.date)} &middot; curated by THE GOOD UP</div>
      ${artBlock(a, 'article__art')}

      <a class="read-full-story" href="${a.source_url}" target="_blank" rel="noopener">
        READ THE FULL STORY AT ${a.source.toUpperCase()}
        <small>Opens the original reporting on ${escapeHtml(a.source)}'s site &#8599;</small>
      </a>

      <p class="curator-note">THE GOOD UP curates this story from ${escapeHtml(a.source)} but doesn't host the full article &mdash; head to the link above to read and support their original reporting.</p>

      <div class="republish-box">
        <div class="republish-box__head">REPUBLISH THIS HEADLINE &mdash; FREE, NO PAYWALL</div>
        <div class="republish-box__body">
          <p>This curated headline card is free to embed on any site or app. It always credits <strong>${escapeHtml(a.source)}</strong> and links back to their original story.</p>
          <label>Embed code:</label>
          <textarea readonly id="embed-snippet">${embedSnippet}</textarea>
          <button class="copy-btn" id="copy-embed">COPY EMBED CODE</button>
          <div class="api-links">
            <a href="/api/articles/${a.slug}" target="_blank" rel="noopener">JSON &#8599;</a>
            <a href="/api/rss.xml" target="_blank" rel="noopener">RSS &#8599;</a>
            <a href="#/develop">Full API docs &#8599;</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const copyBtn = document.getElementById('copy-embed');
  copyBtn.addEventListener('click', () => {
    const ta = document.getElementById('embed-snippet');
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => {
      copyBtn.textContent = 'COPIED!';
      setTimeout(() => (copyBtn.textContent = 'COPY EMBED CODE'), 1500);
    });
  });

  attachClickHandlers();
}

function renderDevelop() {
  markActiveNav('');
  const origin = window.location.origin;
  app.innerHTML = `
    <div class="devpage">
      <h1>API &amp; Republishing</h1>
      <p class="subhead">THE GOOD UP curates breakthrough science and politics stories from Good News Network, Optimist Daily, Positive News, and Good Good Good. No API key, no paywall, no login &mdash; just curated good news, free for anyone to pull into their own site, app, or feed.</p>

      <div class="license-box">
        <strong>THE LICENSE, IN PLAIN ENGLISH:</strong><br/>
        Our curation &mdash; headlines, summaries, categorization, and images pulled from public feeds &mdash; is free to reuse anywhere, on any site, app, or newsletter, at no charge. We don't own the underlying reporting: every story links back to the original publisher, and full articles live on their sites, not ours. Credit "THE GOOD UP" for the curation, and credit the original outlet for the story itself.
      </div>

      <h2>Read the feed</h2>
      <table class="endpoint-table">
        <tr><th>Endpoint</th><th>Method</th><th>Description</th></tr>
        <tr><td><code>/api/articles</code></td><td>GET</td><td>All curated stories, newest first. Filter with <code>?category=</code>, <code>?featured=true</code>, <code>?q=</code>, <code>?limit=</code></td></tr>
        <tr><td><code>/api/articles/:slug</code></td><td>GET</td><td>A single curated story by slug or id.</td></tr>
        <tr><td><code>/api/categories</code></td><td>GET</td><td>List of all categories currently in use.</td></tr>
        <tr><td><code>/api/rss.xml</code></td><td>GET</td><td>Full RSS 2.0 feed, ready for any reader or syndication tool.</td></tr>
        <tr><td><code>/api/docs</code></td><td>GET</td><td>Machine-readable JSON description of this API.</td></tr>
      </table>

      <h2>Example</h2>
      <pre><code>curl ${origin}/api/articles?category=Politics&limit=3</code></pre>

      <h2>Embed a single headline on your site</h2>
      <p>Drop this in your page &mdash; it renders the headline, summary, and image (if one exists), and always links back to the original reporting:</p>
      <pre><code>&lt;blockquote data-goodup-article="ny-first-statewide-ai-data-center-moratorium"&gt;&lt;/blockquote&gt;
&lt;script src="${origin}/embed.js" async&gt;&lt;/script&gt;</code></pre>

      <h2>CORS &amp; rate limits</h2>
      <p>All API responses send <code>Access-Control-Allow-Origin: *</code>, so you can call them directly from client-side JavaScript on any domain. There's no API key and no hard rate limit &mdash; just don't hammer it.</p>
    </div>
  `;
}

function attachClickHandlers() {
  document.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = `#/article/${el.dataset.slug}`;
    });
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function route() {
  const hash = window.location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/').filter(Boolean);

  if (parts.length === 0) {
    renderHome();
  } else if (parts[0] === 'category' && parts[1]) {
    renderCategory(decodeURIComponent(parts[1]));
  } else if (parts[0] === 'article' && parts[1]) {
    renderArticle(decodeURIComponent(parts[1]));
    window.scrollTo(0, 0);
  } else if (parts[0] === 'develop') {
    renderDevelop();
  } else {
    renderHome();
  }
}

window.addEventListener('hashchange', route);
loadData();
