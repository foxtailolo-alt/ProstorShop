# Deployment Runbook

This project intentionally does not use Docker.

---

## 1. Local Development

1. Install PostgreSQL 16+ or use Neon (cloud).
2. Install Node.js 20+ and enable corepack: `corepack enable`.
3. Clone the repo and install deps:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm seed
corepack pnpm dev
```

---

## 2. Environment Variables

Create `.env.local` (for local dev) or set env vars on VPS.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SESSION_SECRET` | Yes | 32+ char secret for HMAC-SHA256 session signing |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public URL, e.g. `https://prostor.shop` |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `TELEGRAM_POST_CHAT_ID` | For posts | Telegram channel/group ID for product posts |
| `TELEGRAM_MINI_APP_URL` | Optional | Mini App URL (defaults to `{SITE_URL}/mini-app`) |
| `BOT_WEBHOOK_URL` | Optional | Domain for bot webhook mode (e.g. `https://prostor.shop`) |
| `BOT_WEBHOOK_PORT` | Optional | Port for webhook (default: 3001) |

---

## 3. VPS Setup (Ubuntu 22.04+)

### 3a. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git postgresql-16 postgresql-contrib
```

### 3b. Node.js via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
corepack enable
```

### 3c. PostgreSQL

```bash
sudo -u postgres psql <<SQL
CREATE USER prostor WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE prostorshop OWNER prostor;
SQL
```

Set `DATABASE_URL=postgresql://prostor:STRONG_PASSWORD_HERE@localhost:5432/prostorshop`

### 3d. Clone & build

```bash
git clone https://github.com/YOUR_USER/ProstorShop.git
cd ProstorShop
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm seed          # first time only
corepack pnpm build
```

---

## 4. Process Management (systemd)

### 4a. Next.js app — `/etc/systemd/system/prostor-web.service`

```ini
[Unit]
Description=ProstorShop Web
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/ProstorShop
EnvironmentFile=/home/deploy/ProstorShop/.env
ExecStart=/home/deploy/.nvm/versions/node/v20.19.0/bin/node apps/web/.next/standalone/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **Note:** For standalone mode, add `output: "standalone"` to `next.config.ts`.
> Alternatively use: `ExecStart=/home/deploy/.nvm/versions/node/v20.19.0/bin/npx next start -p 3000`

### 4b. Bot — `/etc/systemd/system/prostor-bot.service`

```ini
[Unit]
Description=ProstorShop Telegram Bot
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/ProstorShop
EnvironmentFile=/home/deploy/ProstorShop/.env
ExecStart=/home/deploy/.nvm/versions/node/v20.19.0/bin/npx tsx apps/bot/src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Enable & start

```bash
sudo systemctl daemon-reload
sudo systemctl enable prostor-web prostor-bot
sudo systemctl start prostor-web prostor-bot
```

---

## 5. Reverse Proxy (Caddy)

### Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### Caddyfile — `/etc/caddy/Caddyfile`

```
prostor.shop {
    reverse_proxy localhost:3000
    file_server /uploads/* {
        root /home/deploy/ProstorShop/apps/web/public
    }
}
```

Caddy handles TLS automatically via Let's Encrypt.

```bash
sudo systemctl restart caddy
```

---

## 6. Media Persistence

Uploaded images are stored at `apps/web/public/uploads/` (products, banners).

- On redeploy, preserve this directory (symlink or rsync).
- Recommended: symlink `uploads/` to a persistent location:

```bash
mkdir -p /home/deploy/prostor-uploads/products /home/deploy/prostor-uploads/banners
ln -sf /home/deploy/prostor-uploads apps/web/public/uploads
```

---

## 7. Backups

### PostgreSQL daily backup

```bash
# /etc/cron.d/prostor-backup
0 3 * * * deploy pg_dump prostorshop | gzip > /home/deploy/backups/prostor-$(date +\%Y\%m\%d).sql.gz
```

### Retention (keep last 14 days)

```bash
find /home/deploy/backups -name "prostor-*.sql.gz" -mtime +14 -delete
```

---

## 8. Deploy Workflow

```bash
cd /home/deploy/ProstorShop
git pull origin main
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:push          # safe for additive schema changes
corepack pnpm build
sudo systemctl restart prostor-web prostor-bot
```

---

## 9. Monitoring

- `sudo journalctl -u prostor-web -f` — live web logs
- `sudo journalctl -u prostor-bot -f` — live bot logs
- `sudo systemctl status prostor-web` — service health
- Admin activity log at `/admin/activity` — tracks all mutations

---

## Why No Docker

- Fewer moving parts for a single-VPS deployment.
- Lower cognitive load — one OS, one PostgreSQL, one Node.
- Easier debugging, no container layer to troubleshoot.
- Matches the project rule: no Docker in dev or deploy.