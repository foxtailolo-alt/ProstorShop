# ProstorShop

ProstorShop is a fast, SEO-first electronics storefront for the store "Простор" with a public website, Telegram Mini App mirror, Telegram-based authentication, multi-user admin panel, trade-in calculator, service calculator, and Yandex-ready analytics.

## Core Rules

These rules are mandatory for all future work in this repository.

1. Use simple, modern, stable technology.
2. Do not add anything excessive.
3. Keep the architecture flexible so features can be added, changed, or disabled without rewrites.
4. Keep one source of truth for business data and rules.
5. Prefer concise, coherent, elegant solutions.
6. If less code can solve the problem without quality loss, use less code.
7. Always reduce cognitive load for both operators and customers.
8. Always account for end-customer pain points and propose product-development items that improve real buying and service flows.

## Product Scope

### Store Focus

- iPhone
- Samsung
- MacBook
- iPad
- Accessories

### MVP Scope

- Public website with strong performance and SEO.
- Telegram Mini App that mirrors core website flows.
- Telegram-based authentication for customers and admins.
- Multi-user admin panel with role-based access.
- Product catalog with configurable category filters.
- Product pages, cart, and checkout without online payment.
- Trade-in calculator based on an internal pricing matrix.
- Service price calculator based on uploaded Excel or CSV files.
- Telegram group publishing flow with deep links into the Mini App.
- Yandex Metrica and ad-ready attribution foundations.

### Not In MVP

- Online payment.
- CRM or ERP integration.
- Marketplace sync.
- Recommendation engine.

## Engineering Principles

### Architecture

- Monorepo with shared domain logic.
- Public website is the primary SEO surface.
- Telegram Mini App reuses the same data contracts and business rules.
- PostgreSQL is the single source of truth.
- Product, filter, pricing, and role rules must be editable without code changes where practical.
- Feature behavior should be configurable rather than duplicated.
- No Docker dependency in development or deployment.

### Delivery

- Prefer vertical slices over abstract frameworks.
- Keep public APIs and data models explicit.
- Prefer schema-driven forms, validation, and settings when it reduces duplicate code.
- Avoid premature microservices.
- Use server rendering where it improves SEO, performance, and attribution.

### UX

- Mobile-first.
- Fast first load on weak mobile networks.
- Glassmorphism is allowed only when readability, contrast, and performance stay strong.
- Interfaces must stay clean under growth: more products, more filters, more admins, more traffic.

## Recommended Stack

- `pnpm` workspaces
- `Next.js` with App Router and TypeScript
- `React 19`
- `PostgreSQL`
- `Prisma`
- `Telegram Login` plus RBAC in the database
- Direct PostgreSQL setup on local machine and VPS

## Planned Workspace Structure

```text
apps/
  web/        Public storefront, SEO layer, admin routes, Mini App shell
  bot/        Telegram bot and posting flows
packages/
  core/       Shared domain models, validation, feature flags, business rules
  db/         Prisma schema and database package
  ui/         Shared UI primitives and design tokens
  config/     Shared TypeScript, lint, and runtime config
infra/
  Deployment and PostgreSQL setup notes
```

## Product Priorities

1. Clear catalog navigation and filtering.
2. Trust-building product pages with accurate stock and specs.
3. Fast Telegram onboarding.
4. Convenient trade-in and service calculations.
5. Easy admin workflows for non-technical operators.
6. Accurate attribution for Yandex traffic and Telegram conversions.

## Current Delivery Status

### Done

- Monorepo foundation on `pnpm` workspaces with `apps/web`, shared `core`, `db`, `ui`, and Prisma packages.
- Next.js storefront with homepage, catalog, category pages, product pages, cart, trade-in page, service page, and Telegram Mini App entry page.
- Prisma schema connected to PostgreSQL/Neon with seed data for categories, products, trade-in rules, service pricing, feature flags, and roles.
- Telegram authentication flow for production plus localhost-only dev login for admins when Telegram widget rejects local domain.
- Role-aware admin area with operational dashboard instead of a presentation-style mock.
- Admin product management backed by database records, including editing existing products and safe SKU updates.
- Product media expanded from single image to gallery model with support for up to 10 images per product.
- Admin image gallery management: visible order, delete controls, reorder controls, and gallery previews.
- Storefront product gallery: clickable thumbnails, active image switching, and lightbox overlay.
- Product card media component with hover-based image cycling and visual dots for multi-image cards.
- Trade-in and service request flows writing to the database.
- Attribution middleware and Yandex Metrica integration groundwork.
- Basic SEO foundation: metadata, sitemap, robots, canonical URLs.

### Remaining Work

- Validate the hover slideshow thoroughly on all catalog surfaces and polish edge cases on touch devices.
- Finish remaining admin modules to the same operational level as products and dashboard.
- Add real Telegram post publishing workflow in production with channel/group verification and operator UX.
- Harden checkout/admin workflows with more audit coverage, error states, and operator feedback.
- Add deployment runbook details for VPS, backups, media persistence, and process management.
- Add smoke tests/regression checks for auth, cart, product media, and admin product flows.

## Next Session Handoff

### Verified Context

- Root business model is now a real store, not a static showcase.
- Database is PostgreSQL on Neon, Prisma schema is already pushed, and seed data exists.
- `Product.imageUrls` is the active gallery field; first image is treated as primary image.
- Older products may still need defensive fallback to `imageUrl`, so gallery code must preserve backward compatibility.
- Local admin login exists only for localhost development and must not be exposed in production flows.
- Uploaded product images are stored under `apps/web/public/uploads/products`.

### Next Recommended Steps

1. Run a final UI smoke pass for multi-image behavior on home, catalog, category, and product pages.
2. Finish admin polish for orders, trade-in, service requests, and Telegram posting workflow.
3. Add minimal regression coverage around auth, cart, product media ordering, and admin product editing.
4. Prepare deployment checklist for VPS with backups and media persistence.

## Build Order

1. Foundation docs and monorepo bootstrap.
2. Shared config, shared domain package, and database schema.
3. Public storefront skeleton and SEO metadata.
4. Admin panel skeleton and RBAC.
5. Telegram bot and Mini App bridge.
6. Trade-in and service calculators.
7. Analytics, attribution, and VPS deployment.

## Local Setup

1. Install PostgreSQL directly on the machine.
2. Create a database named `prostor`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Run `corepack pnpm install`.
5. Run `corepack pnpm db:generate`.
6. Run `corepack pnpm db:push`.
7. Run `corepack pnpm seed`.
8. Run `corepack pnpm dev`.

## Deployment Direction

- One VPS without Docker.
- PostgreSQL installed directly on the server.
- Next.js app managed by `systemd` or `pm2`.
- Reverse proxy via `Caddy` or `Nginx`.
- Backups handled at PostgreSQL and uploaded media level.

## Media Handling

- Product images can be stored locally in `apps/web/public/uploads`.
- Admin product form supports direct JPG, PNG, and WebP upload.
- Uploaded media should be included in VPS backup policy.

## Definition Of Done

- Website, Mini App, and admin use the same business entities.
- Filters, trade-in rules, and service prices are configurable.
- Category and product pages are crawlable and metadata-complete.
- Telegram deep links open the correct product context.
- The codebase stays small, readable, and change-friendly.