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
  `pnpm start -c` (not `pnpm expo start -c`, which skips the variant).
- **Release builds run R8 and resource shrinking** (`expo-build-properties` in
  `app.json`). Native code reached by reflection, JNI, a resource name or a
  class name the OS persists needs a keep rule in its own module's
  `proguard-rules.pro` (see `modules/finly-capture`), never in `android/`.
- **The dev build is a second app.** `APP_VARIANT=development` (set by
  `pnpm start`, the `development` EAS profile and `pnpm native:dev`) makes
  `com.thecstudio.finly.dev`, "Finly Dev", scheme `finly-dev`; unset is the store
  app. `android/` is generated for one variant: switch with `pnpm native:dev` or
  `pnpm native:prod` (the build script refuses a mismatch). Never write
  `finly://` in code that builds a link — use `appScheme()`.
- **Never run a native build on this machine.** No `pnpm build:dev`, no
  `pnpm build:aab`, no `pnpm android`/`ios`, no `gradlew`. Builds are run
  elsewhere; a local one ties the machine up for a long time and proves nothing
  the gates below do not. `pnpm expo prebuild` is fine — it only writes
  `android/`, it does not compile.

  Everything that does not compile native code is fair game and should be run:
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:colors`,
  `pnpm check:money`, or `pnpm check` for all of them. Where a change can only
  be confirmed on a device, say so and leave it to the person driving.
