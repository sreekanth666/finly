# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code.

# Finly's invariants

`plan docs/finly-mvp-plan.md` is the approved spec and the authority on all of
these. Run `pnpm check` before claiming anything works.

- **pnpm only.** Never npm or npx.
- **Money is integer minor units**, formatted only by `src/domain/money.ts`.
  `pnpm check:money` fails the build otherwise. Never `toFixed`, never a currency
  symbol in a template.
- **Colours come from `src/theme/tokens.css`.** `pnpm check:colors` fails on any
  literal elsewhere, including a quoted CSS colour name in a string.
- **Screens never touch the database.** Screens call feature hooks, hooks call
  repositories, repositories are the only place SQL lives. `src/domain/` is pure:
  no React, no database, no clock except as a defaulted parameter.
- **All hooks above all early returns.** A lookup that becomes a query flips
  between renders, and a hook below the return changes the hook count. This
  broke four detail routes once already; `rules-of-hooks` is an error for it.
- **Dates are derived in local time.** `toISOString` is banned in
  `src/domain/period.ts` and a test proves why.
- **Soft delete everywhere.** Every read filters `deleted_at`.
- Changing a native dependency or an `app.json` plugin needs
  `pnpm expo prebuild --clean`. Changing babel or metro config needs
  `pnpm expo start -c`.
