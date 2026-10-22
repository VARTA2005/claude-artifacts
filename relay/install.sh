#!/usr/bin/env bash
# Установка пересадки «Через свой сервер» для приложения Claude AI (Ubuntu 22.04/24.04, Debian 12).
# Запуск: curl -fsSL <адрес>/install.sh | sudo bash -s -- <адрес-сервера> <ключ-телефона>
# Ставит Caddy (HTTPS-сертификат Let's Encrypt сам) и службу claude-relay. Повторный запуск — обновление.
set -euo pipefail

DOMAIN="${1:-}"
SECRET="${2:-}"
BASE="${RELAY_BASE:-https://raw.githubusercontent.com/VARTA2005/claude-artifacts/main/relay}"
DIR=/opt/claude-relay

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || fail "запустите от root (через sudo)"
[ -n "$DOMAIN" ] && [ -n "$SECRET" ] || fail "нужны адрес сервера и ключ: ... | sudo bash -s -- адрес ключ"
[[ "$SECRET" =~ ^[A-Za-z0-9_-]{16,}$ ]] || fail "ключ — латинские буквы и цифры (скопируйте команду из приложения целиком)"
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
command -v apt-get >/dev/null || fail "нужна Ubuntu или Debian (apt-get)"

say "Проверяю порты 80 и 443"
BUSY="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:(80|443)$/' | grep -v caddy || true)"
[ -z "$BUSY" ] || fail "порт 80 или 443 занят другой программой (не Caddy):
$BUSY
Остановите её (например: systemctl disable --now nginx apache2) и запустите команду снова."

say "Ставлю Caddy и Python"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q python3 curl ca-certificates gnupg >/dev/null
if ! command -v caddy >/dev/null && ! apt-get install -y -q caddy >/dev/null 2>&1; then
  # В системе нет пакета caddy — официальный репозиторий Caddy
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy >/dev/null
fi

say "Скачиваю программу пересадки"
mkdir -p "$DIR"
curl -fsSL "$BASE/relay.py" -o "$DIR/relay.py.new"
python3 -m py_compile "$DIR/relay.py.new" || fail "скачан не тот файл relay.py"
mv "$DIR/relay.py.new" "$DIR/relay.py"
rm -rf "$DIR/__pycache__"
umask 077
printf 'RELAY_SECRET=%s\n' "$SECRET" > /etc/claude-relay.env
umask 022

cat > /etc/systemd/system/claude-relay.service <<'UNIT'
[Unit]
Description=Claude AI: пересадка между браузером и телефоном
After=network-online.target

[Service]
EnvironmentFile=/etc/claude-relay.env
ExecStart=/usr/bin/python3 /opt/claude-relay/relay.py
Restart=always
RestartSec=2
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
MemoryMax=600M

[Install]
WantedBy=multi-user.target
UNIT

say "Настраиваю HTTPS для $DOMAIN"
if [ -f /etc/caddy/Caddyfile ] && ! grep -q 'claude-relay' /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-claude-relay"
fi
cat > /etc/caddy/Caddyfile <<CADDY
# claude-relay: создано установщиком приложения Claude AI
$DOMAIN {
	request_body {
		max_size 100MB
	}
	reverse_proxy 127.0.0.1:8787 {
		flush_interval -1
	}
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || fail "Caddy не принял настройку для $DOMAIN"

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

systemctl daemon-reload
systemctl enable --now claude-relay >/dev/null 2>&1
systemctl restart claude-relay
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy

say "Проверяю (получение сертификата — до минуты)"
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$DOMAIN/relay/ping" >/dev/null 2>&1; then
    printf '\n\033[1;32mГотово!\033[0m Адрес для браузера: \033[1mhttps://%s\033[0m\n' "$DOMAIN"
    echo "Теперь на телефоне включите «3. Через свой сервер»."
    exit 0
  fi
  sleep 3
done
curl -fsS --max-time 5 http://127.0.0.1:8787/relay/ping >/dev/null 2>&1 || fail "служба claude-relay не запустилась: journalctl -u claude-relay -n 30"
fail "пересадка работает, но https://$DOMAIN не открывается. Проверьте, что адрес ведёт на этот сервер и
что в панели хостинга открыты порты 80 и 443. Журнал: journalctl -u caddy -n 30"
