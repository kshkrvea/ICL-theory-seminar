#!/usr/bin/env python3
"""Dev server for slides-html with caching fully disabled.

`python -m http.server` sends Last-Modified but no Cache-Control/ETag, so
browsers heuristically cache the section fragments loader.js fetches at
runtime — edits to sections/*.html can silently stop showing up even after
a hard reload. This wrapper just adds `Cache-Control: no-store` to every
response so every reload is guaranteed fresh.

Usage: python3 serve.py [port]   (default 8000)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"Serving slides-html on http://localhost:{port} (caching disabled)")
    server.serve_forever()
