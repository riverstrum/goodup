#!/usr/bin/env python3
import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(os.environ.get("PORT", 8420))
ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")
ARTICLES_PATH = os.path.join(ROOT, "data", "articles.json")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
}


def load_articles():
    with open(ARTICLES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def rfc822(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%a, %d %b %Y 00:00:00 GMT")


def esc(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


class Handler(BaseHTTPRequestHandler):
    server_version = "GoodUp/1.0"

    def log_message(self, fmt, *args):
        pass

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors_headers()
        self.send_header("Cache-Control", "public, max-age=60")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_rss(self, articles, base_url):
        items = []
        for a in articles:
            image_html = f'<p><img src="{esc(a["image"])}" /></p>' if a.get("image") else ""
            items.append(f"""
    <item>
      <title>{esc(a['title'])}</title>
      <link>{esc(a['source_url'])}</link>
      <guid isPermaLink="false">goodup-{a['id']}</guid>
      <pubDate>{rfc822(a['date'])}</pubDate>
      <category>{esc(a['category'])}</category>
      <source url="{esc(a['source_url'])}">{esc(a['source'])}</source>
      <description>{esc(a['dek'])}</description>
      <content:encoded><![CDATA[{image_html}<p>{a['dek']}</p><p>Curated by THE GOOD UP. Read the full story at <a href="{a['source_url']}">{a['source']}</a>.</p>]]></content:encoded>
    </item>""")
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>THE GOOD UP</title>
    <link>{base_url}</link>
    <description>Start your day with something good. Curated breakthroughs in science and politics, free to read and free to republish.</description>
    <language>en-us</language>
    <docs>{base_url}/api/docs</docs>
    {''.join(items)}
  </channel>
</rss>"""
        body = xml.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
        self._cors_headers()
        self.send_header("Cache-Control", "public, max-age=60")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        if path == "/":
            path = "/index.html"
        file_path = os.path.normpath(os.path.join(PUBLIC_DIR, path.lstrip("/")))
        if not file_path.startswith(PUBLIC_DIR):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Forbidden")
            return
        if not os.path.isfile(file_path):
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        ext = os.path.splitext(file_path)[1]
        try:
            with open(file_path, "rb") as f:
                data = f.read()
        except OSError:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        base_url = f"http://{self.headers.get('Host', f'localhost:{PORT}')}"

        if path == "/api/articles":
            articles = load_articles()
            category = query.get("category", [None])[0]
            featured = query.get("featured", [None])[0]
            q = query.get("q", [None])[0]
            limit = query.get("limit", [None])[0]

            if category:
                articles = [a for a in articles if a["category"].lower() == category.lower()]
            if featured == "true":
                articles = [a for a in articles if a.get("featured")]
            if q:
                needle = q.lower()
                articles = [a for a in articles if needle in a["title"].lower() or needle in a["dek"].lower()]
            articles.sort(key=lambda a: a["date"], reverse=True)
            if limit:
                try:
                    articles = articles[: int(limit)]
                except ValueError:
                    pass

            self._send_json(200, {
                "curator": "THE GOOD UP",
                "license": "Curation free to republish with attribution to THE GOOD UP and the original source. See /api/docs for terms.",
                "count": len(articles),
                "articles": articles,
            })
            return

        if path.startswith("/api/articles/"):
            slug = unquote(path[len("/api/articles/"):])
            articles = load_articles()
            article = next((a for a in articles if a["slug"] == slug or str(a["id"]) == slug), None)
            if not article:
                self._send_json(404, {"error": "Article not found"})
                return
            self._send_json(200, {
                "curator": "THE GOOD UP",
                "license": "Curation free to republish with attribution to THE GOOD UP and the original source. See /api/docs for terms.",
                "article": article,
            })
            return

        if path == "/api/categories":
            articles = load_articles()
            categories = sorted({a["category"] for a in articles})
            self._send_json(200, {"categories": categories})
            return

        if path in ("/api/rss.xml", "/rss.xml"):
            articles = load_articles()
            articles.sort(key=lambda a: a["date"], reverse=True)
            self._send_rss(articles, base_url)
            return

        if path == "/api/docs":
            self._send_json(200, {
                "name": "THE GOOD UP API",
                "version": "1.0",
                "description": "Public read-only API for curated science and politics breakthroughs, sourced from Good News Network, Optimist Daily, Positive News, and Good Good Good. No API key, no paywall, no rate limit beyond fair use.",
                "license": {
                    "summary": "Our curation (headlines, summaries, categorization, images) is free to reuse and republish anywhere, on any site or app. Full articles belong to the original publishers, not us — every entry includes a source_url pointing to the original reporting.",
                    "attribution": 'Credit "THE GOOD UP" for the curation, and credit/link the original source (the "source" and "source_url" fields) for the story itself.',
                },
                "endpoints": [
                    {"path": "/api/articles", "method": "GET", "query": ["category", "featured", "q", "limit"], "description": "List curated articles, newest first."},
                    {"path": "/api/articles/:slug", "method": "GET", "description": "Get a single curated article by slug or id."},
                    {"path": "/api/categories", "method": "GET", "description": "List all categories."},
                    {"path": "/api/rss.xml", "method": "GET", "description": "Full RSS 2.0 feed for syndication."},
                ],
            })
            return

        self._serve_static(path)


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"THE GOOD UP is running at http://localhost:{PORT}")
    print(f"API docs:   http://localhost:{PORT}/api/docs")
    print(f"RSS feed:   http://localhost:{PORT}/api/rss.xml")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
