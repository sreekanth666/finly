# Finly

A local-first expense and budget tracker for Android and iOS. Everything lives in
SQLite on the device: no server, no account, no network dependency.

The approved specification is `plan docs/finly-mvp-plan.md` — domain rules in §4,
the schema in §5, screens in §7, milestones in §9. It is the authority when this
README and the spec disagree.

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
pnpm typecheck        # tsc --noEmit
pnpm test             # jest, over src/domain/ only
pnpm test:tz          # the same suite in three timezones
pnpm check:colors     # no color literal may exist outside src/theme/tokens.css
```

`pnpm test` covers `src/domain/` alone. That is where the correctness risk is —
compounding carry-over, statement-day clamping, paise arithmetic — and it is also
the only part that runs in Node, since `expo-sqlite` is native.

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
