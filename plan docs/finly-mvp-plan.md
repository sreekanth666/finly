# Finly — MVP Plan

**Status:** approved for build · **Date:** 2026-08-26 · **Owner:** Sreekanth K

A local-first expense and budget app for Android and iOS that replaces the
Google Sheet currently used for monthly expense tracking. All data lives in
SQLite on the device. There is no server, no account, and no network dependency
in the MVP.

---

## 1. Why this exists

The sheet works, but it costs effort in four specific ways:

| Friction in the sheet | What the app does instead |
| --- | --- |
| Every expense is typed by hand into a row on a phone browser | Purpose-built entry: amount keypad first, rules pre-fill the rest, four taps for a repeat expense |
| Cancelled expenses are edited to `0`, destroying what actually happened | The expense stays intact; a linked settlement records the money coming back |
| Carry-over of last month's overspend is computed by hand | Derived automatically and shown as part of what's available today |
| Card utilisation and per-card spend are guesswork | The payment source is a real entity, so cycle spend and utilisation are computed |

**Success looks like:** the sheet is abandoned within one month of daily use,
and at any moment the home screen answers "how much can I spend today?" without
arithmetic.

**Non-goals for the MVP:** bill/receipt attachments, income and account
balances, EMI plans, per-category budgets, card payment tracking, notifications,
multi-device sync, multi-currency.

---

## 2. Decisions

Settled during planning. Each entry records the choice and why, so a future
reader can tell a decision from an accident.

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Repayments are **linked settlement records**, not an edit to the expense | Supports partial repayment, repayment in a later month, and preserves history |
| D2 | Carry-over is **overspend only**, and it compounds | Matches current practice; underspend is not banked, so a frugal month can't license a blowout |
| D3 | The monthly flag means **counts toward the budget, or not** | A one-off laptop is real spending but not part of the routine ₹5,000 |
| D4 | **Expenses and settlements only** — no income ledger | Keeps the MVP to the job the sheet does |
| D5 | Expenses carry a **category** from a fixed list, plus free-text item and note | The one field that makes Insights possible |
| D6 | Utilisation = **current billing cycle spend ÷ credit limit** | Needs only statement day and limit; no card payment tracking |
| D7 | Rules **auto-fill during entry** | Directly serves entry speed, and grows into the full engine later |
| D8 | **CSV import + JSON/CSV export** | Existing history comes across; local-only data must have an escape route |
| D9 | **One overall monthly cap**, no per-category budgets | Category caps go stale; look at Insights first, add caps where they earn it |
| D10 | Budget months are **calendar months** | Matches current practice and keeps every total explainable |
| D11 | **expo-sqlite + Drizzle ORM** | Typed schema, compile-time column safety, disciplined migrations |
| D12 | **Move to dev builds**; keep victory-native + Skia | Expo Go can't load Skia; dev builds also unblock future native modules |
| D13 | Insights ships **all four** views: category, trend, card utilisation, top items | Each answers a question currently asked of the sheet |
| D14 | Cards store **statement day only**, no due dates or reminders | Due dates imply tracking payment, which is out of scope |
| D15 | The app is named **Finly** | Matches the repo, package and slug; mockup wordmark gets re-set |

---

## 3. Field study: from sheet to model

Today's columns are `date`, `items`, `note`, `amount`, `from`. They are the right
instincts — the improvements below are about making each field *computable*
rather than adding ceremony to entry.

| Sheet column | Becomes | Why it changes |
| --- | --- | --- |
| `date` | `occurred_at` (epoch ms) + derived `budget_period` (`YYYY-MM`) | A stored period column makes every monthly total an indexed lookup instead of a scan with date maths |
| `items` | `item` (free text, required) | Unchanged in spirit; it is also what rules match against |
| `note` | `note` (free text, optional) | Unchanged |
| `amount` | `amount_minor` (integer paise) | Money must never be a float; ₹1,240.50 is stored as `124050` |
| `from` | `account_id` → `accounts` table | A real entity is what makes utilisation, per-card totals and filtering possible |
| — | `category_id` → `categories` | New. Without it, Insights can only ever be a flat list |
| — | `counts_to_budget` (bool, default true) | New. Encodes the monthly/not-monthly distinction (D3) |
| — | settlements (child table) | New. Replaces manually zeroing a cancelled expense (D1) |
| — | `created_at`, `updated_at`, `deleted_at` | Soft delete gives undo today and sync ordering later |

**Derived, never stored:** `settled_minor` (sum of settlements) and
`effective_minor` (`amount_minor − settled_minor`). Storing them would create two
sources of truth that drift.

### 3.1 Reserved for later, deliberately absent now

The schema is shaped so these arrive as additive migrations, never as a rewrite:
receipt attachments, merchant normalisation, `is_recurring` + recurrence rules,
EMI plans, split expenses, counterparties (who owes you), card payments, tags,
per-category budgets. Section 9 maps each to its migration.

---

## 4. Domain rules

These are the rules the whole app is judged against. They are stated here so the
implementation can be checked against them, and they are implemented as **pure
functions** with unit tests (§8).

### 4.1 Money

- All amounts are integer **minor units** (paise). Currency is `INR`, stored per
  row so multi-currency remains possible without a migration.
- Display formatting is Indian grouping: `₹1,24,050` → `₹1,24,050.00`.
  Formatting lives in one module; no component formats money itself.

### 4.2 Periods

- A budget period is a calendar month in the **device's local timezone**,
  keyed `YYYY-MM`.
- `budget_period` is written at insert/update time from `occurred_at`. Editing
  the date rewrites it.
- Timestamps are stored as UTC epoch milliseconds; only period derivation is
  local. This is documented because it is the classic source of off-by-one-day
  bugs at month boundaries.

### 4.3 Spend

```
settled(e)    = Σ settlements.amount_minor where expense_id = e.id
effective(e)  = max(0, e.amount_minor − settled(e))
spent(P)      = Σ effective(e) for all e where
                  e.budget_period = P
                  and e.counts_to_budget = 1
                  and e.deleted_at is null
```

A settlement reduces the expense **in the expense's own period**, even when the
money comes back in a later month. Recharging a friend in February and being
repaid in March makes *February* ₹0.

*Consequence, accepted deliberately:* a past month's total — and therefore its
carry-over — can change after the fact. The alternative (counting the repayment
in March) keeps history immutable but leaves February permanently overstated,
which is exactly the distortion the sheet has today. Affected periods are
recomputed and the home screen surfaces "February updated" when it happens.

### 4.4 Budget and carry-over

```
budget(P)     = the amount set for P, defaulting to the configured monthly budget (₹5,000)
carryOver(P)  = max(0, spent(P−1) − available(P−1))     // overspend only
available(P)  = budget(P) − carryOver(P)
remaining(P)  = available(P) − spent(P)
```

Carry-over **compounds**: `available(P−1)` already carries its own deduction, so
two bad months in a row bite twice. The first period ever recorded has
`carryOver = 0`.

Worked example:

```
Jan   budget 5,000   spent 5,800   → over 800
Feb   available 5,000 − 800 = 4,200   spent 4,600   → over 400
Mar   available 5,000 − 400 = 4,600
```

**Caching.** `carry_over_minor` is stored on the `budgets` row so the home screen
never walks the full history. It is invalidated and recomputed forward whenever
an expense, settlement or budget amount in period P or earlier changes.
Recomputation is a single pass over periods from the earliest dirty period to the
current one.

### 4.5 Cards and utilisation

- Card expenses count toward the budget in the **calendar month they occurred**,
  regardless of statement or payment date (D10). Budget and billing are separate
  concerns and never mix.
- Utilisation is a separate calculation over the **billing cycle**:

```
cycleStart(card, today) = the most recent occurrence of statement_day on or before today
cycleEnd                = the next occurrence of statement_day, minus one day
cycleSpend(card)        = Σ effective(e) for card expenses with occurred_at in [cycleStart, today]
utilisation(card)       = cycleSpend / credit_limit_minor
```

- **Short-month clamping:** a `statement_day` of 31 resolves to the 28th/29th/30th
  in months that lack it. One helper implements this; every cycle calculation
  uses it.
- `counts_to_budget` does **not** affect utilisation. A ₹45,000 laptop is
  excluded from the budget but absolutely is on the card.

### 4.6 Rules

- A rule is a set of **conditions** and a set of **actions**.
- MVP evaluates on the Add-Expense screen as the item text is typed: highest
  `priority` first, first match wins, actions pre-fill the form.
- Pre-filled fields are always visible and editable — a rule never silently
  decides anything the user can't see and override.
- MVP condition: `item` or `note` `contains` / `equals` / `starts_with` a value
  (case-insensitive). MVP actions: set category, set account, set
  `counts_to_budget`.
- Conditions and actions live in child tables from day one so amount conditions,
  date conditions, alerts and auto-tagging are additive (§9).

---

## 5. Data model

SQLite via `expo-sqlite`, schema and migrations via Drizzle. Every table carries
`id TEXT PRIMARY KEY` (UUID v4), `created_at`, `updated_at`, and — where user
data is destructible — `deleted_at`. UUIDs rather than autoincrement so a future
sync or a restored backup can never collide.

```sql
-- Payment sources: credit cards, bank accounts, cash, wallets
CREATE TABLE accounts (
  id                 TEXT PRIMARY KEY,
  name               TEXT    NOT NULL,              -- "HDFC Millennia"
  type               TEXT    NOT NULL,              -- credit_card | bank | cash | wallet
  issuer             TEXT,                          -- "HDFC Bank"
  last4              TEXT,
  credit_limit_minor INTEGER,                       -- credit_card only
  statement_day      INTEGER,                       -- credit_card only, 1..31
  color_token        TEXT    NOT NULL DEFAULT 'accent',  -- theme token name, never a hex
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_archived        INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  deleted_at         INTEGER,
  CHECK (type IN ('credit_card','bank','cash','wallet')),
  CHECK (statement_day IS NULL OR (statement_day BETWEEN 1 AND 31)),
  CHECK (type <> 'credit_card' OR credit_limit_minor IS NOT NULL)
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  icon        TEXT    NOT NULL,                     -- lucide icon name
  color_token TEXT    NOT NULL,                     -- theme token name
  is_system   INTEGER NOT NULL DEFAULT 0,           -- seeded, not user-deletable
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE expenses (
  id               TEXT    PRIMARY KEY,
  occurred_at      INTEGER NOT NULL,                -- epoch ms, UTC
  budget_period    TEXT    NOT NULL,                -- 'YYYY-MM', local tz, derived
  amount_minor     INTEGER NOT NULL,
  currency         TEXT    NOT NULL DEFAULT 'INR',
  item             TEXT    NOT NULL,
  note             TEXT,
  category_id      TEXT    REFERENCES categories(id),
  account_id       TEXT    REFERENCES accounts(id),
  counts_to_budget INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER,
  CHECK (amount_minor > 0)
);

CREATE INDEX idx_expenses_period   ON expenses(budget_period, deleted_at);
CREATE INDEX idx_expenses_occurred ON expenses(occurred_at DESC);
CREATE INDEX idx_expenses_account  ON expenses(account_id, occurred_at DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id, budget_period);

-- Money coming back against a specific expense
CREATE TABLE settlements (
  id           TEXT    PRIMARY KEY,
  expense_id   TEXT    NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  settled_at   INTEGER NOT NULL,
  account_id   TEXT    REFERENCES accounts(id),     -- where the money landed
  note         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER,
  CHECK (amount_minor > 0)
);

CREATE INDEX idx_settlements_expense ON settlements(expense_id, deleted_at);

-- One row per month, created lazily on first use of that period
CREATE TABLE budgets (
  id               TEXT    PRIMARY KEY,
  period           TEXT    NOT NULL UNIQUE,         -- 'YYYY-MM'
  amount_minor     INTEGER NOT NULL,
  carry_over_minor INTEGER NOT NULL DEFAULT 0,      -- cached; see §4.4
  carry_recomputed_at INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE rules (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 0,         -- higher wins
  is_enabled    INTEGER NOT NULL DEFAULT 1,
  match_mode    TEXT    NOT NULL DEFAULT 'all',     -- all | any (future: mixed)
  times_applied INTEGER NOT NULL DEFAULT 0,
  last_applied_at INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE TABLE rule_conditions (
  id       TEXT PRIMARY KEY,
  rule_id  TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  field    TEXT NOT NULL,                           -- item | note (future: amount, account, weekday)
  operator TEXT NOT NULL,                           -- contains | equals | starts_with (future: gt, lt, regex)
  value    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE rule_actions (
  id       TEXT PRIMARY KEY,
  rule_id  TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,                           -- set_category | set_account | set_counts_to_budget
  value    TEXT NOT NULL,                           -- id or '0'/'1'
  created_at INTEGER NOT NULL
);

-- Key/value app settings: monthly_budget_minor, currency, onboarding_done, schema_seeded
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Seed data** (first launch): categories — Food, Groceries, Transport, Bills,
Shopping, Health, Personal, Other; `monthly_budget_minor = 500000` (₹5,000); no
accounts (the user adds their own, prompted once).

**Integrity handled in the repository layer**, since SQLite can't express it:
total settlements for an expense may not exceed its amount; a card account
cannot be hard-deleted while expenses reference it (archive instead).

---

## 6. Architecture

Built on what already exists: Expo SDK 57, expo-router, HeroUI Native + uniwind,
the Zenith token layer (`src/theme/`), and the four-tab shell.

```
src/
  db/
    client.ts            expo-sqlite connection, PRAGMA setup (WAL, foreign_keys ON)
    schema.ts            Drizzle table definitions — single source of truth
    migrations/          drizzle-kit generated SQL + journal
    seed.ts              first-run categories and settings
    repositories/        expenses.ts, settlements.ts, accounts.ts, budgets.ts, rules.ts
  domain/
    money.ts             minor-unit maths and ₹ formatting
    period.ts            period keys, month boundaries, statement-day clamping
    budget.ts            spent / carryOver / available / remaining  (pure)
    utilisation.ts       cycle window and utilisation               (pure)
    rules.ts             condition matching and action application  (pure)
  features/
    expenses/            add-edit form, list, detail, settlement sheet
    budget/              home summary, month switcher
    accounts/            account CRUD, card cards
    rules/               list and editor
    insights/            the four views
    data-transfer/       CSV import, JSON/CSV export
  components/            shared UI (existing: amount, progress-ring, stat-card, …)
  theme/                 existing token layer
```

**Layering rule:** screens never touch the database. Screens call feature hooks,
hooks call repositories, repositories are the only place SQL lives. Domain
functions are pure and take plain data — no database, no React. This is what
makes the budget maths testable.

**Reactivity:** Drizzle's `useLiveQuery` for `expo-sqlite` re-renders on table
change, so no additional state library. Derived values (`effective`, `spent`,
`utilisation`) are computed in domain functions from live query results.

**Migrations:** `drizzle-kit generate` produces versioned SQL, applied on startup
before the first render. Migration failure shows a recoverable error screen with
an export option, never a white screen.

**Dev workflow change (D12):** Expo Go is dropped. `expo prebuild` +
`expo run:android` for a dev client, since Skia and future native modules cannot
load in Expo Go.

---

## 7. Screens

### 7.1 Balance (home)

Month header with switcher · the Safe-to-Spend ring, now driven by real data
(`remaining(P)` against `available(P)`) · a carry-over line when non-zero
("₹800 carried from January") · card row showing cycle spend, utilisation and
days to statement · the last few expenses · FAB to add.

### 7.2 Add / Edit expense — the flow that has to be excellent

Ordered by what the user knows first:

1. **Amount** — large numeric keypad on open, no keyboard hunt.
2. **Item** — free text; rules match as you type and pre-fill below, with recent
   items as suggestions.
3. **Category** — chips, most-used first.
4. **Account** — chips, defaulting to the last used.
5. **Date** — Today by default; Yesterday and a picker one tap away.
6. **Counts to budget** — a toggle, on by default.
7. **Note** — collapsed until wanted.

Save, or **Save & add another** which keeps date and account. A rule-matched
repeat expense should be four taps: amount, item, confirm, save. Every
rule-filled field is marked so it's obvious what was decided for you.

### 7.3 Transactions

Grouped by day like the mockup, with month/category/account filters, text search
over item and note, and a "budget only" toggle. Settled expenses show the
original amount struck through beside the effective one. Swipe to delete with
undo (soft delete makes this free).

### 7.4 Expense detail

Full record, its settlements, and **Add settlement** (amount, date, where the
money landed, note). Shows "₹500 of ₹500 returned — counts as ₹0".

### 7.5 Rules

List by priority with an on/off switch and a "used 34 times" stat. Editor:
conditions, actions, and a live preview of how many existing expenses would match
— so a rule can be judged before it's saved.

### 7.6 Insights (D13)

Spend by category (donut + ranked list) · month-over-month bars against the
budget line · card utilisation per card · top items and merchants for the month.

### 7.7 Settings

Monthly budget · accounts and cards · categories · import and export · about.

---

## 8. Testing

Unit tests (`jest-expo`) over the pure domain layer, which is where the
correctness risk actually lives:

- `budget.ts` — spend with and without settlements; overspend carry;
  compounding across three months; first-ever period; `counts_to_budget`
  exclusion; a settlement landing in a later month recomputing an earlier one.
- `period.ts` — month boundaries in local time; statement-day clamping for 29,
  30 and 31 across February and 30-day months.
- `utilisation.ts` — cycle window either side of the statement day; excluded
  budget expenses still counting toward utilisation.
- `rules.ts` — priority ordering, first-match-wins, case-insensitive matching.
- `money.ts` — no float drift; Indian digit grouping.

Repository tests run against an in-memory SQLite database: soft delete respected
everywhere, settlements capped at the expense amount, cascade on expense delete.

Manual acceptance per milestone, on an Android dev build.

---

## 9. Milestones

Each is independently shippable and leaves the app usable.

| # | Milestone | Contents | Done when |
| --- | --- | --- | --- |
| M0 | Foundation | Dev build, expo-sqlite + Drizzle, migrations, seed, repository skeleton | App boots on a migrated database with seeded categories |
| M1 | Expense CRUD | Add/edit/delete, Transactions list, filters, search | A full day's expenses can be entered and found; the sheet has a rival |
| M2 | Budget | Budget row, carry-over engine, home wired to real data | Home shows correct available/spent/remaining across three seeded months |
| M3 | Accounts | Account CRUD, card fields, cycle spend, utilisation on home | Each card shows correct cycle spend and utilisation % |
| M4 | Settlements | Settlement records, expense detail, effective amounts | The recharge case reads ₹0 and February's carry-over updates |
| M5 | Rules | Rules CRUD, evaluation during entry, match preview | A "swiggy" rule fills category and account while typing |
| M6 | Insights | The four views | Each chart matches hand-checked numbers for a seeded month |
| M7 | Data transfer | CSV import with mapping and preview, JSON + CSV export | The real Google Sheet imports cleanly, exports and re-imports identically |
| M8 | Hardening | Empty states, error boundaries, migration failure recovery, a11y pass, perf on 2,000+ expenses | Daily use for a week with no data loss and no janky screens |

---

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| **Device loss wipes everything** — no server | M7 export ships early enough to matter; a periodic export reminder; JSON backup restores fully |
| **Retroactive carry-over confuses** — a settlement changes a past month | Show what changed and why; never silently alter a past total |
| **Timezone drift at month boundaries** | One period module, UTC storage, local derivation, tests at the boundary |
| **Statement-day clamping** | One helper, tested against February and 30-day months |
| **Migration failure bricks the app** | Migrations run before first render behind a recovery screen offering export |
| **Scope creep from the future list (§3.1)** | Nothing from §3.1 enters the MVP; the schema already accommodates it |
| **Dev-build friction** (D12) | Documented rebuild step whenever native dependencies change |

---

## 11. After the MVP

Ordered by expected value, each additive against the existing schema:

1. **Receipt attachments** — `attachments` table + `expenses.attachment_id`; the
   field the user already knows they want.
2. **Recurring expenses** — `expenses.is_recurring` + a `recurrences` table;
   forecasting the fixed monthly base.
3. **Card payments and true utilisation** — a `card_payments` table upgrades D6
   from cycle spend to unpaid balance.
4. **Income and balances** — a `transactions` supertype over expenses.
5. **People and lending** — `counterparties` + `settlements.counterparty_id`,
   turning settlements into a per-person ledger.
6. **EMI plans** — `emi_plans` + `expenses.emi_plan_id`.
7. **Per-category budgets** — `category_budgets` keyed by period.
8. **Rules v2** — amount and date conditions, alert actions, auto-tagging; the
   condition/action tables already allow it.
9. **Sync** — UUIDs, `updated_at` and `deleted_at` are already in place.
