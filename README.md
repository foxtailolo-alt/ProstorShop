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
- **Phone authentication** — register/login by phone number and password alongside Telegram. Session cookie supports both auth methods. `SessionUser.telegramId` is optional; promo code generation falls back to `userId`.
- Profile area with Telegram login fallback, loyalty balance, order history, stored phone, and per-user referral promo code.
- **Auth UI redesign** — side-by-side auth cards (phone left, Telegram right) with "или" divider on `/profile` and `/login`. Telegram widget rewritten with `useEffect`+`ref` for reliable loading.
- Promo and loyalty system in Prisma: `PromoCode`, `PointTransaction`, order promo linkage, cashback tracking, and referral owner rewards.
- Cart/order flow with product variants, stored per-item price snapshot, promo apply/clear, and variant-aware order items.
- Admin order workflow with cashback accrual on completion, referral reward accrual, promo visibility, and profile revalidation.
- Role-aware admin area with operational dashboard instead of a presentation-style mock.
- Admin product management with modal dialog: create/edit, category tree select, recommendation picker, auto-generated SKU.
- Admin product UX hardening: inline save errors, save-in-place success feedback, local preview/reorder for newly selected images, image manager sync, and catalog revalidation after image changes.
- **Product delete safety** — `OrderItem.productId` is now nullable with `onDelete: SetNull`. Products with existing orders can be deleted; orders show "Удалённый товар".
- Product specs editor with AI auto-fill via OpenAI Responses API (`web_search_preview` tool for factual data from the internet).
- **Stricter AI specs prompt** — requires official sources only (apple.com, GSMArena, iXBT, 4PDA), forbids model confusion (Pro ≠ Pro Max), returns error for unconfirmed products, uses `json_object` format.
- AI specs endpoint supports direct OpenAI or internal proxy mode via `OPENAI_PROXY_URL` and `OPENAI_PROXY_SECRET`.
- Production AI proxy is routed through a separate supported-region host; operator-facing AI errors now explain region blocks clearly.
- **AI-powered SEO generation** — `/api/ai/seo` endpoint generates `seoTitle`, `seoDescription`, and `seoKeywords` for categories, targeted at Нижний Новгород with web search for semantic core. Button "Заполнить с ИИ" in category form.
- Product options system: configurable option groups (e.g. "Storage", "SIM type") with per-variant or additive pricing and storefront option picker with dynamic price updates.
- Product media: gallery model with up to 10 images, admin image gallery manager with reorder/delete, storefront lightbox gallery.
- Product card media: cursor-position-based image switching on hover (left→right = first→last photo).
- Product recommendations: schema, admin picker, storefront display section.
- Banner carousel: admin CRUD (up to 5 active), storefront auto-rotating slider with swipe support. Recommended banner size: 2100×900px (21:9). Banners support `categorySlug` for linking to category pages.
- **Hierarchical category management** — full tree UI in admin with expand/collapse, parent/leaf logic on storefront, breadcrumbs on product pages, leaf-only product assignment. Auto-slug with cyrillic transliteration.
- **Homepage redesign** — dynamic admin-managed sections via `HomepageSection`/`HomepageItem` models. Admin UI at `/admin/marketing/homepage`. Section types: bestsellers grid, category grid (with hover subcategories, Apple/Samsung span 2 cols), 3D coverflow carousel (perspective + drag/swipe + autoplay).
- **Product import** — 347 products and 96 hierarchical categories imported from `offers.xlsx` with CDN image URLs.
- **Square media workflow** — product and category uploads are normalized to square `1400x1400` WebP via `sharp`. Admin image editing now uses a square zoom editor with drag, zoom-out, center snapping, and visual guides instead of crop.
- **Draft-safe admin image editing** — pending product uploads keep background removal and square edits local until the operator presses save; cancel no longer persists image changes.
- **Homepage admin UX polish** — searchable product picker for homepage sections uses a portal dropdown and works correctly above layered glass sections. Category images now use a dedicated square editor card.
- **Admin product catalog redesign** — `/admin/products` now has server-side category and status filters, preserved pagination params, richer horizontal cards, and category path labels.
- **Telegram post templates** — publishing and preview use a shared plain-text template builder with optional store footer injection. Premium/custom emoji HTML mode was removed.
- `Category.imageUrl` field for category grid display.
- `seoKeywords` field on Category model, rendered as `<meta name="keywords">` on category pages.
- Trade-in and service request flows writing to the database.
- Telegram bot deep links now open the Mini App directly, support `startapp` product context, and configure the menu button.
- Telegram post publishing now returns operator-friendly errors instead of failing silently.
- **Storefront visual polish** — bestsellers cards and coverflow cards use unified white card backgrounds; coverflow keeps the 3D look, loops seamlessly, and no longer fades non-active cards.
- Backup login flow for the owner via `/api/auth/bootstrap-login` guarded by `AUTH_BOOTSTRAP_SECRET`.
- Attribution middleware and Yandex Metrica integration groundwork.
- Basic SEO foundation: metadata, sitemap, robots, canonical URLs.
- Production deployment to VPS is live on `https://88-218-64-61.sslip.io`, and Telegram login was fixed to use the real HTTPS domain instead of localhost.
- Safe production packaging and env guards exist: `corepack pnpm deploy:pack` and `corepack pnpm --filter @prostor/web build:prod`.
- Production media storage is externalized via `UPLOADS_DIR=/home/deploy/prostor-uploads`, and release archives no longer overwrite the uploads directory.
- Verified 2026-04-24: if files were changed only in `apps/web/public/uploads`, a normal `deploy:pack` release is not enough; those media files must be synced to `/home/deploy/prostor-uploads` separately.
- Vitest coverage expanded for banners, cart variants, AI specs route, cart-selection helpers, and catalog tree helpers (60 tests across 9 files).

### Remaining Work

- Run a focused production smoke check for admin flows: category reorder, `/admin/products` live filters, competitor pricing review flow, and media editing after save.
- **Populate homepage sections** — use admin UI at `/admin/marketing/homepage` to create bestsellers, category grid, and coverflow sections with real product data.
- Run a full post-deploy smoke check for the live stack: `/login`, `/profile`, cart promo flow, referral promo flow, homepage section management, Telegram post publishing, and Mini App launch from bot.
- Fix product options cart/order flow — extend CartItem type & OrderItem model to include `variantLabel`.
- Apply and document the Prisma migration path for production instead of relying only on `db push` as the schema continues to grow.
- Finish production setup for Telegram posting and verify the target channel/group permissions with the current bot token.
- Test phone auth flow end-to-end on production (register, login, profile display, logout).
- Consider bcrypt or argon2 for password hashing (currently SHA-256) before launching phone auth publicly.
- Add AI SEO generation for products (currently only categories have it).

## Next Session Handoff (Updated 2026-04-24)

### Verified Context

- Root business model is now a real store, not a static showcase.
- Database is PostgreSQL on Neon, Prisma schema is already pushed. **347 products and 96 categories** imported from `offers.xlsx` with CDN image URLs (`https://cdn.ibotby.ru/...`).
- `Product.imageUrls` is the active gallery field; first image is treated as primary image.
- `Product.specs Json?` stores key-value characteristics filled via AI or manually.
- `Product.options Json?` stores option groups with variant/additive pricing model.
- `Banner` model with admin CRUD and storefront carousel. `categorySlug` field links banner clicks to category pages.
- **HomepageSection/HomepageItem** models for admin-managed homepage. Admin UI at `/admin/marketing/homepage`. Tables exist; section management now includes searchable product selection and square category image editing.
- **Image workflow**: product and category images are normalized through `saveProductImage` / `saveCategoryImage` to square `1400x1400` WebP. The current admin editor is `SquareImageEditorModal` with zoom, drag, center snapping, and percent readout.
- Pending product uploads respect `persistChanges={false}` for both square editing and background removal; changes stay local until the product form is saved.
- **sharp 0.34.5** installed as devDependency in `@prostor/web` for server-side image processing.
- Orders now persist `variantLabel`, `appliedPromoCodeId`, `promoRewardDescription`, and `cashbackPointsAwarded`.
- `User` now stores `phone` and `loyaltyPoints`; referral promo creation happens automatically on Telegram login.
- Test admin user: phone `+79991394133`, role `admin`.
- Promo cookie handling lives in `apps/web/lib/promo.ts` and must stay signed with `AUTH_SESSION_SECRET`.
- Mini App product deep links are centralized in `packages/core/src/telegram.ts` and reused by bot/web code.
- Production public URLs must come from `/home/deploy/ProstorShop/.env`; `apps/web/.env.local` must not exist on the VPS.
- `scripts/assert-public-env.mjs` blocks unsafe production builds, and `scripts/build-deploy-archive.mjs` creates the safe release tarball.
- The live site already serves the correct login domain `https://88-218-64-61.sslip.io`.
- Uploaded media must use `UPLOADS_DIR` on production; current VPS value is `/home/deploy/prostor-uploads` and nginx serves `/uploads/*` from the same location.
- Production code and schema were redeployed successfully on 2026-04-24; the VPS now matches the local workspace commit content for `package.json` and `packages/db/prisma/schema.prisma`.
- A server backup exists from before the deploy in `/home/deploy/backups` as `ProstorShop_20260424_171441.tgz` and `prostor-uploads_20260424_171441.tgz`.
- Local product images for AirPods Max 2 were missing on the VPS after deploy because `deploy:pack` excludes uploads by design; they were fixed by syncing local `apps/web/public/uploads` into `/home/deploy/prostor-uploads` separately.
- When local changes touch uploaded files, the production deploy checklist must include an extra media sync step after code deploy.
- AI specs endpoint uses Responses API (`/v1/responses`) with `web_search_preview` tool for factual data.
- `infra/ai-proxy/server.py` supports configurable upstream URLs; its real `proxy.env` must stay outside git.
- Root SSH access on the main VPS accepts `~/.ssh/prostor_tradein_bot_ed25519_nopass` for passwordless deploys.
- Telegram post publishing is plain-text now; shared formatting lives in `apps/web/lib/telegram-post-template.ts`. Premium/custom emoji HTML formatting was intentionally removed.
- `/admin/products` now supports server-side `category` and `status` filters with pagination preserving active params.
- Storefront coverflow uses a seamless loop with duplicated slides to avoid visible edge-jumps; non-active cards remain opaque and cards use solid white backgrounds.
- Bestsellers cards now also use solid white backgrounds and a more compact layout without stock text.

### Next Recommended Steps

1. **Deploy to VPS**: `corepack pnpm deploy:pack` → scp → extract → `db push` → restart. Latest code includes square media workflow, homepage admin polish, admin product filters, Telegram post template helpers, and coverflow/bestsellers visual changes.
2. **If media changed locally**: sync `apps/web/public/uploads` to `/home/deploy/prostor-uploads` separately; the release tarball intentionally excludes uploads.
3. **Populate homepage sections**: Use `/admin/marketing/homepage` to create bestsellers, category grid, and coverflow sections.
4. Run a full manual production smoke test for login, profile, cart, promo, homepage admin flows, Telegram posting, and Mini App launch.
5. Fix product options cart/order flow — variants lost on add-to-cart.
6. Convert schema changes into proper Prisma migrations before next structural update.
7. Verify Telegram posting end-to-end with the current bot token and target channel permissions.

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
- Build production releases with `corepack pnpm deploy:pack` so local `.env` files and `.next` output are not shipped.
- On the VPS, keep production public URLs only in `/home/deploy/ProstorShop/.env` and remove `apps/web/.env.local` before `build:prod`.
- On production, set `UPLOADS_DIR=/home/deploy/prostor-uploads` so uploaded media lives outside the release directory and survives deploys.
- If local media files were edited directly under `apps/web/public/uploads`, sync them to `/home/deploy/prostor-uploads` separately after the code release.

## Media Handling

- Product images can be stored locally in `apps/web/public/uploads`.
- On the VPS, nginx should serve `/uploads/*` from the same directory specified by `UPLOADS_DIR`.
- Admin product form supports direct JPG, PNG, and WebP upload.
- Uploaded media should be included in VPS backup policy.
- `corepack pnpm deploy:pack` does not ship local uploads; that is intentional.

## Definition Of Done

- Website, Mini App, and admin use the same business entities.
- Filters, trade-in rules, and service prices are configurable.
- Category and product pages are crawlable and metadata-complete.
- Telegram deep links open the correct product context.
- The codebase stays small, readable, and change-friendly.
