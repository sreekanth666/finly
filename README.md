# Finly

A local-first expense and budget tracker for Android and iOS. Everything lives in
SQLite on the device: no server, no account, no network dependency.

The approved specification is [`plan docs/finly-mvp-plan.md`](plan%20docs/finly-mvp-plan.md)
— domain rules in §4, the schema in §5, screens in §7, milestones in §9. It is
the authority when this README and the spec disagree, and it is checked in for
exactly that reason.

## Running it

This project uses **pnpm**, and **Expo Go will not work** — `expo-sqlite` and the
other native modules need a development build.

```bash
pnpm install
pnpm android          # expo run:android
pnpm ios              # expo run:ios
```

The first run generates `android/` and `ios/` via prebuild. Both are gitignored,
so **any change to a native dependency or to the plugin list in `app.json` needs
a rebuild**:

```bash
pnpm expo prebuild --clean
pnpm android
```

After changing `babel.config.js` or `metro.config.js`, clear the bundler cache:

```bash
pnpm expo start -c
```

## The database

Schema lives in `src/db/schema.ts` and is the single source of truth. After
editing it:

```bash
pnpm db:generate      # drizzle-kit generate → drizzle/
```

`drizzle/` is **checked in on purpose**. The generated `.sql` files are pulled
into the bundle by `babel-plugin-inline-import`, so a release build fails without
them.

Migrations run on boot, before any route mounts. If they fail, the app shows a
recovery screen that hands the user their raw database file rather than a white
screen — see `src/features/recovery/`.

## Checks

```bash
pnpm check            # everything below, in one command
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint . — never mutates the repo, see below
pnpm test             # jest
pnpm test:tz          # the same suite in three timezones
pnpm check:colors     # no color literal outside src/theme/tokens.css
pnpm check:money      # no money formatted outside src/domain/money.ts
```

Two suites. `src/domain/` is the pure layer, where most of the correctness risk
lives — compounding carry-over, statement-day clamping, paise arithmetic.
`src/db/` applies the **generated** migration to Node's built-in `node:sqlite`
and asserts the SQL contract: every constraint, soft delete across aggregates,
both cascade directions, the settlement cap, and the rule that off-budget
spending leaves the budget alone but still counts on the card.

Neither reaches the repository functions themselves — `expo-sqlite` is native and
has no Node build.

`eslint.config.js` is checked in and `lint` runs `eslint` directly. `expo lint`
would install ESLint and write that config itself, silently and without prompting
in a non-interactive shell, which made linting a command that changed the repo as
a side effect of being run.

## Layout

```
src/
  app/          expo-router routes. Screens never touch the database.
  features/     hooks and draft↔row mappers, one folder per area.
  components/   shared presentational UI.
  db/           schema, the single connection, repositories, reactivity.
  domain/       pure functions. No React, no database, no clock.
  theme/        design tokens. The only place a color may be written.
```

Reads go through `useDbQuery` in `src/db/live.ts` — one hook, not two; the
reasoning is in that file. Writes go through `useAction`. Drizzle's expo driver
is synchronous, so repositories are too; `src/db/transaction.ts` explains what
that buys and what it costs.

## Money

Every amount is an integer number of minor units. ₹1,240.50 is `124050`, never
`1240.5`. `src/domain/money.ts` is the only place that formats one, and
`pnpm check:money` enforces that.

The display currency is a setting, chosen during onboarding and changeable in
Settings. It is **not** multi-currency, which the spec excludes: changing it
converts nothing, it only changes the symbol and how digits are grouped — ₹1,24,050
and $124,050 are the same stored integer.

## Security

App lock and database encryption are both opt-in from Settings → Security, off by
default. The SQLCipher build ships regardless, because a SQLCipher binary with no
key behaves as ordinary SQLite — which is what lets encryption be switched on
later without a native rebuild.

Encryption copies the database through `sqlcipher_export()` into a keyed file and
swaps them; `PRAGMA rekey` cannot encrypt a plaintext database. The connection is
a module-scope singleton, so switching it needs an app restart. **The key lives in
the device keychain and nowhere else** — if that is lost, an export is the only
way back.
