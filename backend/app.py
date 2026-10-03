"""Local web server and JSON API for Fiscais Canoas."""

from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import hmac
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

from database import ROOT, create_assignment, initialize, locations

PUBLIC_DIR = ROOT / "frontend" / "public"
MAX_BODY_BYTES = 8_192


class Application(BaseHTTPRequestHandler):
    server_version = "FiscaisCanoas/0.2.0"

    def log_message(self, format, *args):
        print(f"{self.client_address[0]} - {format % args}")

    def send_json(self, status: HTTPStatus, payload: dict | list):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/locations":
            return self.send_json(HTTPStatus.OK, locations())
        if path == "/":
            path = "/index.html"
        requested = (PUBLIC_DIR / unquote(path).lstrip("/")).resolve()
        if PUBLIC_DIR not in requested.parents or not requested.is_file():
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Recurso não encontrado."})
        content = requested.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(requested.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def can_write(self) -> bool:
        token = os.environ.get("FISCAIS_ADMIN_TOKEN")
        if token:
            return hmac.compare_digest(self.headers.get("X-Admin-Token", ""), token)
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def do_POST(self):
        if urlparse(self.path).path != "/api/assignments":
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Recurso não encontrado."})
        if not self.can_write():
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Acesso administrativo necessário."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_BODY_BYTES:
                raise ValueError("Conteúdo inválido.")
            payload = json.loads(self.rfile.read(size))
            result = create_assignment(payload)
        except (ValueError, json.JSONDecodeError) as error:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        return self.send_json(HTTPStatus.CREATED, result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()
    initialize()
    server = ThreadingHTTPServer((args.host, args.port), Application)
    print(f"Fiscais Canoas disponível em http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
