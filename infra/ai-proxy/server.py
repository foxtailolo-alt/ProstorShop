import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
PROXY_SECRET = os.environ.get("OPENAI_PROXY_SECRET", "").strip()
LISTEN_HOST = os.environ.get("AI_PROXY_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("AI_PROXY_PORT", "3100"))


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/openai/responses":
            self._json(404, {"error": "Not found"})
            return

        if not OPENAI_API_KEY:
            self._json(500, {"error": "OPENAI_API_KEY missing on proxy"})
            return

        if not PROXY_SECRET:
            self._json(500, {"error": "OPENAI_PROXY_SECRET missing on proxy"})
            return

        if self.headers.get("X-Proxy-Secret", "") != PROXY_SECRET:
            self._json(403, {"error": "Forbidden"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)

        req = Request(
            "https://api.openai.com/v1/responses",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=120) as response:
                response_body = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get_content_type())
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
        except HTTPError as error:
            response_body = error.read() or b'{"error":"OpenAI upstream error"}'
            self.send_response(error.code)
            self.send_header("Content-Type", error.headers.get_content_type() if error.headers else "application/json")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
        except URLError as error:
            self._json(502, {"error": "Upstream connection failed", "details": str(error.reason)})

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
            return

        self._json(404, {"error": "Not found"})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.serve_forever()