"""Private, dependency-free HTTP adapter for the case engine (Python 3.11+)."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import secrets
from case_engine import generate_case


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.reply(200, {"status": "ok", "engine": "casefile-v1"}) if self.path == "/health" else self.reply(404, {"message": "Not found"})

    def do_POST(self):
        if self.path != "/v1/cases/generate":
            return self.reply(404, {"message": "Not found"})
        expected = os.environ.get("GENERATOR_SECRET", "local-development-only")
        if not secrets.compare_digest(self.headers.get("X-Generator-Secret", ""), expected):
            return self.reply(401, {"message": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                return self.reply(413, {"message": "Expected a small JSON body"})
            payload = json.loads(self.rfile.read(length))
            seed = payload.get("seed", secrets.randbelow(2**31))
            if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed < 2**31:
                return self.reply(400, {"message": "seed must be an integer from 0 to 2147483647"})
            self.reply(200, generate_case(seed))
        except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
            self.reply(400, {"message": "Invalid JSON request"})

    def log_message(self, format, *args):
        # Do not log authorization headers or generated solutions.
        print(f"generator: {self.command} {self.path} -> {args[1] if len(args) > 1 else '-'}", flush=True)


if __name__ == "__main__":
    address = (os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8001")))
    print(f"Case engine listening on {address[0]}:{address[1]}", flush=True)
    ThreadingHTTPServer(address, Handler).serve_forever()
