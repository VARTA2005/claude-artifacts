#!/usr/bin/env python3
"""Пересадка «Через свой сервер» для приложения Claude AI (Android).

Claude работает на телефоне. Телефон сам держит связь с сервером: спрашивает /relay/pull (долгий опрос) и
отправляет ответы в /relay/respond/<id>. Браузеры открывают адрес сервера — каждый их запрос ждёт здесь,
пока телефон его заберёт и ответит. Входящих подключений к телефону нет, данные на сервере не хранятся.

Только стандартная библиотека Python 3. Слушает 127.0.0.1 (снаружи — Caddy с HTTPS).
Ключ телефона — переменная окружения RELAY_SECRET.
"""

import base64
import hmac
import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("RELAY_SECRET", "")
HOST = os.environ.get("RELAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("RELAY_PORT", "8787"))
PULL_WAIT = 25          # сколько держать запрос телефона, если браузерам ничего не нужно
ANSWER_WAIT = 120       # сколько браузер ждёт ответа телефона
PHONE_ONLINE = 40       # телефон на связи, если спрашивал не позже этого
MAX_BODY = 100 * 1024 * 1024
MAX_QUEUE = 200
HOP = {"connection", "keep-alive", "proxy-connection", "transfer-encoding", "te", "trailer", "upgrade",
       "content-length", "host", "proxy-authorization"}


class Pending:
    def __init__(self, data):
        self.id = data["id"]
        self.data = data
        self.done = threading.Event()
        self.status = 502
        self.headers = {}
        self.body = b""


lock = threading.Condition()
queue = []              # запросы браузеров, которые телефон ещё не забрал
waiting = {}            # id -> Pending (забран телефоном или ждёт)
phone = {"seen": 0.0, "pulls": 0, "version": ""}


def phone_online():
    return phone["pulls"] > 0 or time.time() - phone["seen"] < PHONE_ONLINE


OFFLINE_PAGE = """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10">
<title>Claude — телефон не на связи</title>
<style>body{font-family:system-ui,sans-serif;background:#262624;color:#ece9e1;display:flex;min-height:100vh;
margin:0;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
div{max-width:460px}h1{font-size:22px;font-weight:600;color:#d97757}p{line-height:1.5;color:#c3c0b6}</style>
</head><body><div><h1>Телефон не на связи</h1>
<p>Сервер работает, но телефон с приложением Claude AI сейчас к нему не подключён.</p>
<p>На телефоне: «Настройки» → «Доступ с компьютера» → «3. Через свой сервер» — включите и проверьте, что
есть интернет. Страница обновится сама.</p></div></body></html>"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ClaudeRelay"
    sys_version = ""

    def log_message(self, fmt, *args):
        pass  # без журнала запросов: адреса и пути не записываются

    # ---------------------------------------------------------------- ответы

    def send(self, status, body=b"", headers=None, content_type=None):
        self.send_response(status)
        sent = set()
        for k, v in (headers or {}).items():
            if k.lower() in HOP:
                continue
            self.send_header(k, v)
            sent.add(k.lower())
        if content_type and "content-type" not in sent:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, status, obj):
        self.send(status, json.dumps(obj, ensure_ascii=False).encode(), {"Cache-Control": "no-store"},
                  "application/json; charset=utf-8")

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("too large")
        return self.rfile.read(length) if length > 0 else b""

    def phone_auth(self):
        given = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
        return bool(SECRET) and hmac.compare_digest(given.encode(), SECRET.encode())

    # ---------------------------------------------------------------- маршруты

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def do_HEAD(self):
        self.route()

    def do_OPTIONS(self):
        self.route()

    def route(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/relay/ping":
                self.send_json(200, {"relay": "Claude AI", "phone": phone_online(), "version": phone["version"]})
            elif path == "/relay/pull" and self.command == "POST":
                self.pull()
            elif path.startswith("/relay/respond/") and self.command == "POST":
                self.respond(path[len("/relay/respond/"):])
            elif path.startswith("/relay/"):
                self.send_json(404, {"error": "Нет такого адреса"})
            else:
                self.forward()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except ValueError:
            self.close_connection = True
            self.send_json(413, {"error": "Слишком большой запрос"})

    def pull(self):
        """Телефон забирает запросы браузеров; если их нет — ждёт до PULL_WAIT секунд."""
        if not self.phone_auth():
            self.read_body()
            self.send_json(401, {"error": "Неверный ключ сервера"})
            return
        info = self.read_body()
        try:
            phone["version"] = str(json.loads(info or b"{}").get("version", ""))[:40]
        except (ValueError, AttributeError):
            pass
        # ?wait=0 — первый опрос после подключения: телефон сразу узнаёт, что ключ подошёл
        wait = PULL_WAIT
        if "wait=0" in self.path.split("?", 1)[-1].split("&"):
            wait = 0
        deadline = time.time() + wait
        with lock:
            phone["pulls"] += 1
            phone["seen"] = time.time()
            try:
                while not queue and time.time() < deadline:
                    lock.wait(deadline - time.time())
                batch = queue[:20]
                del queue[:20]
            finally:
                phone["pulls"] -= 1
                phone["seen"] = time.time()
        try:
            self.send_json(200, {"requests": [p.data for p in batch]})
        except OSError:
            # Телефон оборвал связь — запросы достанутся следующему опросу
            with lock:
                queue[:0] = [p for p in batch if p.id in waiting]
            raise

    def respond(self, rid):
        if not self.phone_auth():
            self.read_body()
            self.send_json(401, {"error": "Неверный ключ сервера"})
            return
        body = self.read_body()
        with lock:
            pending = waiting.get(rid)
            phone["seen"] = time.time()
        if pending is not None:
            try:
                pending.status = int(self.headers.get("X-Relay-Status") or 502)
                raw = self.headers.get("X-Relay-Headers") or ""
                pending.headers = json.loads(base64.b64decode(raw).decode()) if raw else {}
            except (ValueError, TypeError):
                pending.status, pending.headers = 502, {}
            pending.body = body
            pending.done.set()
        self.send_json(200, {"ok": pending is not None})

    def forward(self):
        """Запрос браузера: в очередь телефону и ждать ответ."""
        body = self.read_body()
        if not phone_online():
            self.offline()
            return
        forwarded = self.headers.get("X-Forwarded-For") or ""
        ip = forwarded.split(",")[-1].strip() if forwarded else self.client_address[0]
        headers = {k.lower(): v for k, v in self.headers.items() if k.lower() not in HOP}
        headers.pop("x-forwarded-for", None)
        pending = Pending({
            "id": uuid.uuid4().hex,
            "method": self.command,
            "target": self.path,
            "headers": headers,
            "body": base64.b64encode(body).decode() if body else "",
            "ip": ip,
        })
        with lock:
            if len(queue) >= MAX_QUEUE:
                self.send_json(503, {"error": "Телефон не успевает — попробуйте позже"})
                return
            waiting[pending.id] = pending
            queue.append(pending)
            lock.notify_all()
        try:
            answered = pending.done.wait(ANSWER_WAIT)
        finally:
            with lock:
                waiting.pop(pending.id, None)
                if pending in queue:
                    queue.remove(pending)
        if not answered:
            if phone_online():
                self.send_json(504, {"error": "Телефон не ответил вовремя"})
            else:
                self.offline()
            return
        self.send(pending.status, pending.body, pending.headers)

    def offline(self):
        wants_page = self.command == "GET" and "text/html" in (self.headers.get("Accept") or "")
        if wants_page:
            self.send(503, OFFLINE_PAGE.encode(), {"Cache-Control": "no-store"}, "text/html; charset=utf-8")
        else:
            self.send_json(503, {"error": "Телефон не на связи", "offline": True})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128


def main():
    if not SECRET:
        raise SystemExit("Нет RELAY_SECRET — ключ телефона")
    print(f"Пересадка Claude: http://{HOST}:{PORT}", flush=True)
    Server((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
