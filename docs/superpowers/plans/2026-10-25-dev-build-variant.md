# Installable Dev Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A development build of Finly that installs beside the production app on one phone, with its own application ID, name and link scheme.

**Architecture:** `app.json` stays the production source of truth. A new `app.config.ts` receives it and, when `APP_VARIANT=development`, overrides the identity fields (name, package/bundle ID, scheme, dev-client scheme). Every place that hard-codes the `finly://` scheme (widget, review notification) reads the running app's scheme instead, so a tap in the dev app opens the dev app. The build scripts pass the variant through and refuse to build over a native project generated for the other variant.

**Tech Stack:** Expo SDK 57 dynamic config (`app.config.ts`), EAS build `env`, Kotlin (expo-modules), Jest (`jest-expo/node`), Node scripts.

**Spec:** No separate spec. The design is the one agreed in conversation, following the Expo variants guide (https://docs.expo.dev/build-reference/variants/). Repo rules: `AGENTS.md`.

## Global Constraints

- pnpm only; never npm/npx.
- Never run a native build (`pnpm build:dev`, `pnpm build:aab`, `pnpm android`, `gradlew`). `pnpm expo prebuild` and `pnpm expo config` are allowed. Run `pnpm check` before claiming anything works.
- Production identity must not change: `com.thecstudio.finly` (Android package and iOS bundle ID), scheme `finly`, name `Finly`, slug `finly`.
- Development identity: name `Finly Dev`, ID `com.thecstudio.finly.dev`, scheme `finly-dev`. The slug stays `finly` (it is tied to the EAS project `e93e0736-a990-4843-a83d-af028e8f2908`).
- Colours only in `src/theme/tokens.css`; no colour literal under `src/`. Money formatting untouched.
- The Kotlin package `com.thecstudio.finly.capture` is a source namespace and does not change.
- Variant values: only `development` or `production`. Unset means production. Anything else throws.

## Review Focus

- `APP_VARIANT` mistyped (`develpoment`): must fail loudly, not silently build the production identity.
- `pnpm start` run without the variant: the dev client would be served scheme `finly` and its widget/notification links would open the production app. The `start` script must set the variant.
- `android/` generated for one variant, then a build for the other: the build script must stop and say which prebuild command to run, not ship the wrong ID.
- `Constants.expoConfig.scheme` is `string | string[] | undefined`: the helper must take the first scheme, and fall back to `finly` when it is missing.
- Notification tap before JavaScript has ever pushed the scheme to native: Kotlin defaults to `finly`. This only matters on a fresh install of the dev build, and the notification cannot fire before the first launch has pushed the scheme.

---

### Task 1: Variant-aware app config

**Files:**
- Create: `app.config.ts`
- Test: `src/domain/__tests__/app-variants.test.ts` (reads `app.config.ts` from disk the way `fixtures/capture-gate.ts` reads Kotlin; `src/domain/` is where the Jest `testMatch` looks)

**Interfaces:**
- Produces: `type AppVariant = 'development' | 'production'`; `resolveVariant(raw: string | undefined): AppVariant` (throws `Error` containing the bad value and the allowed ones); default export `({ config }: ConfigContext) => ExpoConfig` that reads `process.env.APP_VARIANT` at call time.

- [ ] **Step 1: Write the failing tests** in `src/domain/__tests__/app-variants.test.ts`. Import `resolveVariant` and the default export from `../../../app.config`, and `expo` from `../../../app.json` as the base `config`. Assertions:
  - `resolveVariant(undefined)` and `resolveVariant('production')` return `'production'`; `resolveVariant('development')` returns `'development'`.
  - `resolveVariant('develpoment')` throws, message includes `develpoment`.
  - With `APP_VARIANT` unset, the resolved config equals the base on `name`, `scheme`, `android.package`, `ios.bundleIdentifier` (`Finly`, `finly`, `com.thecstudio.finly`, `com.thecstudio.finly`) and `slug` is `finly`.
  - With `APP_VARIANT=development`: `name` is `Finly Dev`, `scheme` is `finly-dev`, both IDs are `com.thecstudio.finly.dev`, `slug` is still `finly`, and the `android.permissions`, `android.adaptiveIcon` and every non-`expo-dev-client` plugin are unchanged from the base.
  - The `expo-dev-client` plugin entry carries `{ addGeneratedScheme: true }` in development and `{ addGeneratedScheme: false }` in production. Both exactly once.
  - Restore `process.env.APP_VARIANT` after each test.

- [ ] **Step 2: Run to verify it fails.** Run: `pnpm test src/domain/__tests__/app-variants.test.ts`. Expected: FAIL, cannot find module `app.config`.

- [ ] **Step 3: Implement `app.config.ts`** per the signatures above. Spread the incoming `config`, override only the fields listed, spread `config.android` / `config.ios` before setting the ID so permissions and icons survive, and append the `expo-dev-client` entry to `config.plugins`. Table of per-variant values as a `const VARIANTS: Record<AppVariant, {...}>`.

- [ ] **Step 4: Run to verify it passes.** Run: `pnpm test src/domain/__tests__/app-variants.test.ts`. Expected: PASS.

- [ ] **Step 5: Confirm Expo itself resolves it.** Run: `APP_VARIANT=development pnpm expo config --json` and check `name`, `scheme`, `android.package`. Run `pnpm expo config --json` and check the production values. Expected: both match the constants above. This also proves Expo's loader accepts the `.ts` config, which the unit test cannot.

- [ ] **Step 6: Commit.**

```bash
git add app.config.ts src/domain/__tests__/app-variants.test.ts
git commit -m "feat(build): app.config.ts — a development variant with its own ID, name and scheme"
```

---

### Task 2: Links follow the running app's scheme (JavaScript side)

**Files:**
- Create: `src/domain/deep-link.ts` (pure)
- Create: `src/features/navigation/app-scheme.ts` (the only place that touches `expo-constants` for this)
- Modify: `src/features/widget/month-glance-widget.tsx:25-26` and its two `clickActionData` uses
- Test: `src/domain/__tests__/deep-link.test.ts`

**Interfaces:**
- Produces (`deep-link.ts`): `pickScheme(raw: string | readonly string[] | null | undefined): string` returns the first non-empty scheme, else `'finly'`; `deepLink(scheme: string, path: string): string` returns `` `${scheme}://${path}` `` (so `deepLink('finly', '')` → `finly://`, and the widget's home link becomes `finly:///` via path `'/'`).
- Produces (`app-scheme.ts`): `appScheme(): string` = `pickScheme(Constants.expoConfig?.scheme)`.
- Consumes: nothing from Task 1 at runtime; the value arrives through the Expo manifest.

- [ ] **Step 1: Write the failing tests** in `deep-link.test.ts`: `pickScheme('finly-dev')` → `finly-dev`; `pickScheme(['finly-dev', 'other'])` → `finly-dev`; `pickScheme([])`, `pickScheme('')`, `pickScheme(undefined)`, `pickScheme(null)` → `finly`; `deepLink('finly-dev', 'expense/new')` → `finly-dev://expense/new`; `deepLink('finly', '/')` → `finly:///`.
- [ ] **Step 2: Run to verify it fails.** Run: `pnpm test src/domain/__tests__/deep-link.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `deep-link.ts` and `app-scheme.ts`** with the signatures above. `deep-link.ts` imports nothing.
- [ ] **Step 4: Replace the two constants in `month-glance-widget.tsx`** with calls built from `appScheme()` at render time (`deepLink(appScheme(), '/')` and `deepLink(appScheme(), 'expense/new')`). Keep the `'use no memo'` header and the existing comment style; the file must still export `WIDGET_NAME` unchanged.
- [ ] **Step 5: Run `pnpm check`.** Expected: all gates pass, with the 8 React Compiler warnings that are the standing baseline and no new ones.
- [ ] **Step 6: Commit.**

```bash
git add src/domain/deep-link.ts src/domain/__tests__/deep-link.test.ts src/features/navigation/app-scheme.ts src/features/widget/month-glance-widget.tsx
git commit -m "feat(widget): home-screen widget links follow the running app's scheme"
```

---

### Task 3: Review notification follows the scheme (native side)

**Files:**
- Modify: `modules/finly-capture/android/src/main/java/com/thecstudio/finly/capture/CapturePrefs.kt` (add `var linkScheme: String`, key `link_scheme`, default `"finly"`)
- Modify: `modules/finly-capture/android/src/main/java/com/thecstudio/finly/capture/FinlyCaptureModule.kt:114` (add `Function("setLinkScheme") { scheme: String -> CapturePrefs(context).linkScheme = scheme }` beside `setNotifyEnabled`)
- Modify: `modules/finly-capture/android/src/main/java/com/thecstudio/finly/capture/CaptureNotifier.kt:35` (`Uri.parse("${CapturePrefs(context).linkScheme}://inbox")`; the `setPackage(context.packageName)` stays)
- Modify: `modules/finly-capture/index.ts` (declare `setLinkScheme(scheme: string): void`)
- Modify: `src/features/capture/sync.ts:75-82` (call `native.setLinkScheme(appScheme())` in the existing settings effect, before `setEnabled`)

**Interfaces:**
- Consumes: `appScheme(): string` from Task 2.
- Produces: native `setLinkScheme(scheme: string): void`.

- [ ] **Step 1: Make the five edits above.** Kotlin edits are three lines in total; match the neighbouring `Function(...)` and `var` style exactly.
- [ ] **Step 2: Run `pnpm check`.** Expected: PASS. This proves the TypeScript and lint side only; Kotlin is not compiled here (no native builds on this machine).
- [ ] **Step 3: Commit.**

```bash
git add modules/finly-capture src/features/capture/sync.ts
git commit -m "fix(capture): the review notification opens the app that posted it, whatever its scheme"
```

**Device check (left to the person driving):** in the dev build, with detection on and the app backgrounded, tap the "transactions to review" notification and confirm the dev app opens on the inbox, not the production app. Same for both widget buttons. This is the only part of the change that cannot be confirmed by `pnpm check`.

---

### Task 4: Scripts, EAS and build-script guard

**Files:**
- Modify: `package.json` scripts: `"start": "APP_VARIANT=development expo start"`; add `"native:dev": "APP_VARIANT=development expo prebuild --clean"` and `"native:prod": "expo prebuild --clean"`. (Not `prebuild:*`: npm treats `pre<name>` as a hook for `<name>`, and `build:dev` exists.)
- Modify: `eas.json`: add `"env": { "APP_VARIANT": "development" }` to the `development` profile only. `preview` and `production` stay production-identity.
- Create: `scripts/android-variant.mjs`: `expectedVariantId(variant: 'development' | 'production'): string` (runs `pnpm expo config --json` with `APP_VARIANT` set and returns `android.package`) and `generatedApplicationId(androidDir: string): string | null` (reads `applicationId` from `android/app/build.gradle`; `null` if absent).
- Modify: `scripts/android-build.mjs`: each entry in `MODES` gets `variant` (`dev` → `development`, `aab` → `production`). The script sets `APP_VARIANT` for its prebuild call, and before Gradle compares `generatedApplicationId` with `expectedVariantId`; on mismatch it calls `fail(...)` with the hint `pnpm native:dev` or `pnpm native:prod` as appropriate.

**Interfaces:**
- Consumes: `app.config.ts` from Task 1 (through `pnpm expo config`).

- [ ] **Step 1: Implement `scripts/android-variant.mjs`** with the two exports.
- [ ] **Step 2: Verify the helpers without Gradle.** Run: `node --input-type=module -e "import('./scripts/android-variant.mjs').then(m => console.log(m.expectedVariantId('development'), m.expectedVariantId('production'), m.generatedApplicationId('android')))"`. Expected: `com.thecstudio.finly.dev com.thecstudio.finly com.thecstudio.finly` (the existing `android/` was generated for production).
- [ ] **Step 3: Wire the guard and variant into `android-build.mjs`; edit `package.json` and `eas.json`.** The guard runs before the `./gradlew` call, so a mismatch exits before any compile.
- [ ] **Step 4: Verify the guard's failure path without building.** The `dev` mode with the current production `android/` must stop at the guard. Do not run it (it would reach Gradle if the guard were wrong). Instead run the helper comparison from Step 2 and confirm the two IDs differ, then read the guard code against it. State in the summary that the full path was not executed because native builds are off-limits here.
- [ ] **Step 5: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 6: Commit.**

```bash
git add package.json eas.json scripts/android-variant.mjs scripts/android-build.mjs
git commit -m "feat(build): dev builds carry the dev variant; the build script refuses a stale android/"
```

---

### Task 5: Say how it works

**Files:**
- Modify: `AGENTS.md`: one invariant bullet under "Finly's invariants".
- Modify: `plan docs/finly-mvp-plan.md`: one decision row (next free `D` number, same table style as D12 and D17) recording why two installable variants.

- [ ] **Step 1: Add the AGENTS.md bullet.** Content: dev and production are separate apps (`com.thecstudio.finly.dev` / `.finly`, schemes `finly-dev` / `finly`); `APP_VARIANT` selects; switching variant locally means `pnpm native:dev` or `pnpm native:prod` then a build; never hard-code `finly://`, use `appScheme()`.
- [ ] **Step 2: Add the plan-doc decision row**, one paragraph: what, and why (a debug build cannot replace a release-signed install, and shared storage risks real data).
- [ ] **Step 3: Run `pnpm check`.** Expected: PASS.
- [ ] **Step 4: Commit.**

```bash
git add AGENTS.md "plan docs/finly-mvp-plan.md"
git commit -m "docs: two installable variants, and how to switch between them"
```

---

## Not in this plan (decisions for you)

- **Dev icon.** The name and ID tell the apps apart, but a tinted or badged icon makes it obvious on the home screen. It needs artwork; the config change is one line per platform once the file exists.
- **Listener label.** The native service is labelled "Finly transaction detection" in the manifest, so Settings → Notification access will list two identically named entries. Fixing it needs a manifest label that follows the variant (a small config plugin) and cannot be checked without a native build, so it is left out until you decide it matters.
- **Preview profile.** `preview` keeps the production identity. If you want preview builds beside production too, it is a third entry in the variants table.

## Self-review

- **Coverage:** separate ID and name (Task 1), scheme collisions in widget and notification (Tasks 2–3), `expo start` serving the right scheme (Task 4), EAS cloud builds (Task 4), local build safety (Task 4), documentation (Task 5). The dev-client generated scheme (`exp+finly`), which would otherwise collide, is handled in Task 1.
- **One production change:** `expo-dev-client` is now configured with `addGeneratedScheme: false` for production, which removes the dev-only `exp+finly` scheme from release builds. This follows the Expo guide and is the only edit that alters production's native manifest.
- **Types:** `pickScheme`, `deepLink`, `appScheme`, `setLinkScheme`, `resolveVariant`, `expectedVariantId` and `generatedApplicationId` are named identically wherever used.
