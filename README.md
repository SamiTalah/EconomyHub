# CartWise Stockholm

Grocery basket optimizer for Stockholm. Compares regular store prices, weekly deals/reklamblad, and travel costs to find the cheapest way to fill your shopping list.

## Features

- **Basket optimization** — Enter your shopping list, location, and car profile to find the cheapest store (single or two-store combination)
- **Weekly deals** — Factors in approved weekly flyer deals, including multi-buy, member-only, and per-household limits
- **Travel cost calculation** — Haversine distance with configurable car fuel/EV profile
- **Price provenance** — Every price shows source, observation date, and freshness
- **Admin ingestion** — CSV upload for regular prices, JSON/manual entry for deals
- **Stockholm scoped** — 17 seeded stores across Stockholm metro with ~250 products

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + Radix UI primitives
- PostgreSQL + Prisma ORM
- Vitest (unit tests) + Playwright (E2E)
- Docker Compose for local dev

## Getting Started

### 1. Start the database

```bash
docker compose up db -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run migrations and seed data

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home — shopping list builder
│   ├── results/            # Optimization results
│   ├── stores/             # Store list + map
│   ├── admin/              # Admin dashboard
│   │   ├── prices/upload/  # CSV price upload
│   │   ├── deals/          # Deal flyer management
│   │   └── health/         # Data freshness dashboard
│   └── api/                # API routes
├── components/
│   ├── ui/                 # Design system (shadcn-style)
│   ├── home/               # Home page components
│   ├── results/            # Results page components
│   ├── stores/             # Store page components
│   └── admin/              # Admin components
├── lib/
│   ├── optimizer.ts        # Pure optimization functions
│   ├── actions.ts          # Server actions
│   ├── db.ts               # Prisma client
│   ├── distance.ts         # DistanceProvider interface
│   ├── constants.ts        # Config, labels, presets
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Utility functions
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed data (Stockholm stores/products/prices/deals)
tests/                      # Vitest unit tests
e2e/                        # Playwright E2E tests
```

## CSV Price Upload Format

Upload via `/admin/prices/upload`. Semicolon or comma separated:

```csv
store_name;chain;format;city;lat;lng;gtin;product_name_sv;brand;size_value;size_unit;category;subcategory;price_sek;unit_price_sek;unit_unit;in_stock;observed_at
Willys Hornstull;WILLYS;WILLYS;Stockholm;59.3158;18.0340;;Mjölk 3% 1.5L;Arla;1.5;L;MEJERI_AGG;MJOLK;17.90;11.93;KR_PER_L;true;2025-01-15
```

**Chains:** ICA, COOP, WILLYS, HEMKOP, CITY_GROSS, LIDL, OTHER
**Formats:** ICA_MAXI, ICA_KVANTUM, ICA_SUPERMARKET, ICA_NARA, STORA_COOP, COOP, COOP_NARA, WILLYS, WILLYS_HEMMA, HEMKOP, CITY_GROSS, LIDL
**Categories:** FRUKT_GRONT, MEJERI_AGG, KOTT, FISK_SKALDJUR, CHARK_PALAGG, BROD_BAGERI, SKAFFERI, FRYST, DRYCK, SNACKS_GODIS, BARN_BABY, HALSA_SKONHET, VEGO, HEM_STAD, DJUR

## Deals JSON Import Format

POST to `/api/admin/deals` with `type: "json_import"`:

```json
{
  "store_name": "Willys Hornstull",
  "chain": "WILLYS",
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "items": [
    {
      "name": "Nötfärs 500g",
      "brand": "Garant",
      "price_sek": 39.90,
      "multi_buy_type": "NONE",
      "member_only": false,
      "conditions": null,
      "gtin": null
    },
    {
      "name": "Mjölk 3%",
      "brand": "Arla",
      "price_sek": 35.00,
      "multi_buy_type": "X_FOR_Y",
      "multi_buy_x": 2,
      "multi_buy_y": 35.00,
      "member_only": false,
      "conditions": "2 för 35 kr"
    }
  ]
}
```

**Multi-buy types:** NONE, X_FOR_Y, BUY_X_GET_Y, PERCENT_OFF

## Testing

```bash
# Unit tests
npm test

# E2E tests (requires running app + database)
npm run test:e2e
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://cartwise:cartwise@localhost:5432/cartwise` |
| `ADMIN_PASSWORD` | Admin area password | `cartwise-admin-2024` |

## Optimization Algorithm

1. Filter stores within user's radius (Haversine distance)
2. For each store, compute effective price per item (regular vs deal)
3. Deal logic handles: X_FOR_Y bundles, member-only gates, per-household limits
4. Missing items penalized at 50 SEK each
5. Travel cost = round-trip distance × fuel consumption × energy price
6. Two-store heuristic: top 6 stores evaluated as pairs, only if savings > 10 SEK vs single store
