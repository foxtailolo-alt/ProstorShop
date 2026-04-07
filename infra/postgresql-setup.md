# PostgreSQL Setup

This project intentionally does not use Docker.

## Local Development

1. Install PostgreSQL 16 or newer.
2. Create a database for the project.
3. Set `DATABASE_URL` in `.env`.
4. Run:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm seed
corepack pnpm dev
```

## VPS Setup

1. Install PostgreSQL directly on the VPS.
2. Create a dedicated database user with a strong password.
3. Restrict DB access to localhost or private network.
4. Run the Next.js app through `systemd` or `pm2`.
5. Use `Caddy` or `Nginx` as reverse proxy.
6. Configure regular PostgreSQL backups.

## Why

- Less moving parts.
- Lower cognitive load.
- Easier debugging on one VPS.
- Matches the no-Docker project rule.