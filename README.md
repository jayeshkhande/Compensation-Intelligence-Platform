# CompScope — Compensation Intelligence Platform

**Assignment:** AI Software Engineer Internship — Demo Task
**Role chosen:** Role 3 — Full Stack Engineer
**Track chosen:** Track B — Compensation Intelligence System

Mandatory research and the feature comparison sheet (Levels.fyi, 6figr, AmbitionBox, Glassdoor)
are in [`docs/RESEARCH.md`](./docs/RESEARCH.md).

## Why this is not "a salary listing website"

The core idea, taken directly from the assignment brief: **levels matter more than job titles**.
Two "Software Engineer" rows at the same company can mean very different pay if one is L3 and the
other is L6. So `level` is a first-class, indexed, filterable column — not text buried inside a
job title — and every comparison, aggregation, and chart in this app is built around
company + role + **level** + location, not just company + role.

## Architecture

```
                    ┌─────────────────────┐
                    │     Next.js UI      │
                    │ React + TypeScript  │
                    │     TailwindCSS     │
                    └──────────┬──────────┘
                               │  fetch()
                               ▼
                    ┌─────────────────────┐
                    │  Next.js API Routes │
                    │  (app/api/**)       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Prisma ORM      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    └─────────────────────┘
```

One Next.js app serves both the frontend (App Router pages, mostly server components for
data-heavy pages like the dashboard and company detail, client components where interactivity is
needed — filters, sorting, forms) and the backend (API routes under `app/api/`). Prisma is the only
thing that talks to Postgres; nothing else in the app constructs raw SQL.

### Data model

```
Company ──1:N──> SalaryRecord
   │
   └──1:N──> CompanyAlias   (raw name variants that resolve to this Company)
```

- **Company** — canonical, normalized company record (e.g. "Google").
- **CompanyAlias** — every raw spelling ever ingested for that company (e.g. "Google India",
  "GOOGLE LLC"). Lets us always trace back to the source data.
- **SalaryRecord** — one compensation data point: role, level, location, base, bonus, stock, and a
  server-computed `totalComp`. A composite unique constraint on
  `(companyId, role, level, location, source)` is what powers duplicate detection.

Full schema: [`prisma/schema.prisma`](./prisma/schema.prisma).

### Backend logic (`lib/`)

- **`normalization.ts`** — resolves any raw company-name string to a canonical `Company`. Strips
  legal suffixes ("Pvt Ltd", "LLC", "Inc", "Corp"...) and trailing geo qualifiers ("India", "USA"),
  slugifies the result, and checks both the alias table and the canonical slug before deciding
  whether to create a new company. New raw variants are recorded as aliases so nothing is lost.
- **`validation.ts`** — a Zod schema that rejects negative numbers, non-numeric input, and missing
  required fields (company/role/level/location/base salary), while defaulting missing
  bonus/stock to `0`. Also implements the duplicate check against the composite unique key.
- **`compensation.ts`** — `totalComp = base + bonus + stock`, always computed server-side. The API
  never trusts a client-submitted total.

### API surface

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/salaries` | List records — filter by `company`, `role`, `level`, `location`, `minTotal`/`maxTotal`; sort by `sortBy`/`sortDir`; paginate via `page`/`pageSize`. Filtering/sorting/pagination all happen in the Prisma query, not client-side. |
| POST | `/api/salaries` | Ingest one record. Validates → normalizes company → checks duplicates → computes total → inserts. |
| GET | `/api/salaries/:id` | Fetch one record. |
| PUT | `/api/salaries/:id` | Update one record (re-runs validation + normalization + total calc). |
| DELETE | `/api/salaries/:id` | Delete one record. |
| GET | `/api/companies` | List all companies with record count + average total comp. |
| GET | `/api/companies/:id` | One company (by id or slug) with level breakdown, distinct locations, aliases, and all its records — powers the Company Page. |
| GET | `/api/compare?ids=a,b,c` | Fetch 2–3 records by id, in the order given, for the Compare view. |
| GET | `/api/analytics` | Aggregated data shaped for the two charts (avg total comp by company; avg base/bonus/stock breakdown by company). |

### Frontend pages

- **`/`** — dashboard with headline stats and links into the rest of the app.
- **`/salaries`** — Salary Explorer: filters, sortable columns, pagination, row selection for
  comparison.
- **`/companies`** and **`/companies/[id]`** — company list and the aggregated company page
  (average comp, level breakdown, locations, full record table).
- **`/compare`** — pick 2–3 records (via search or carried over from the Explorer) and see them
  side-by-side.
- **`/analytics`** — two charts (Recharts): average total comp by company, and a stacked
  base/bonus/stock breakdown.
- **`/admin`** — data ingestion form that hits `POST /api/salaries` and surfaces validation errors
  inline.

## Setup

```bash
git clone <this-repo-url>
cd compscope
npm install

cp .env.example .env
# edit .env with a real PostgreSQL connection string
# (Neon / Railway / Render / local Postgres all work)

npx prisma migrate dev --name init   # creates tables
npm run prisma:seed                  # loads ~20 realistic sample records
npm run dev                          # http://localhost:3000
```

### Deployment

- **App (frontend + API routes):** Vercel.
- **Database:** Neon (serverless Postgres) — set `DATABASE_URL` in Vercel's environment
  variables to the Neon connection string, then run `npx prisma migrate deploy` against it.

## Design decisions & tradeoffs

- **Level as a free-text but indexed field**, not an enum. Every company has its own leveling
  scheme (L3–L8, E3–E9, SDE1–3, numeric bands like "59"/"62"...). An enum would force premature
  standardization across companies that don't share a scheme; free text keeps ingestion simple at
  the cost of not being able to do cross-company level equivalence (e.g. "Google L5 ≈ Amazon
  SDE3") out of the box — a reasonable v2 feature once enough data exists to calibrate it.
- **Total compensation is always server-computed**, never accepted from the client, so it can't
  drift from base+bonus+stock even if a future client has a bug.
- **Company normalization is alias-based**, not fuzzy-matching on every request. Fuzzy string
  matching (e.g. Levenshtein distance) would be more "automatic" but is slower and can silently
  merge two genuinely different companies with similar names. The alias table is a small tradeoff
  in ingestion-time bookkeeping for deterministic, auditable normalization.
- **Duplicate detection is a hard composite unique key** (`company+role+level+location+source`)
  rather than a fuzzy "looks similar" check. Simpler and predictable, at the cost of not catching
  near-duplicates that differ only by a typo in one field.
- **No authentication.** Out of scope per the research decision in `docs/RESEARCH.md` — the
  assignment explicitly says to build 3–4 (or here, 6) features extremely well rather than sprawl
  into a full marketplace. Login/saved-comparisons is left as a documented limitation.

## Known limitations

- No authentication — the admin ingestion page is unauthenticated, which is fine for this demo but
  would need to be locked down before any real-world use.
- No cross-company level-equivalence mapping (see tradeoffs above).
- Currency is stored per-record (`currency` field, defaults to `INR`) but the UI formats
  everything as INR lakhs — multi-currency display isn't implemented.
- Seed data is illustrative sample data, not scraped real-world figures.
- No automated test suite is included; manual test scenarios (duplicate records, missing
  bonus/stock, invalid salary, unknown company, filters, comparison, pagination, API errors) were
  exercised manually during development, per the assignment's Phase 6.

## Submission checklist (per assignment Step "📤 Submission")

- [ ] Deploy to Vercel + Neon and record the live URL
- [ ] Push this repository to GitHub and record the URL
- [ ] Record a 5–10 minute Loom walking through architecture, decisions, edge cases, and tradeoffs
      (this README + `docs/RESEARCH.md` are written to double as talking points for that video)
- [ ] Submit all three via the assignment's Google Form
