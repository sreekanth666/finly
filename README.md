<h1 align="center">Finly</h1>

<p align="center">
  <strong>An offline personal finance tracker that tells you how much you can spend today.<br>
  No account. No cloud. No ads. Your data never leaves your phone.</strong>
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.thecstudio.finly">
    <img alt="Get it on Google Play" height="56"
      src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg">
  </a>
</p>

<!--
  Screenshots go here. Drop PNGs into docs/screenshots/ and uncomment:

  <p align="center">
    <img src="docs/screenshots/home.png" width="22%" alt="Home: safe to spend today">
    <img src="docs/screenshots/add-expense.png" width="22%" alt="Adding an expense">
    <img src="docs/screenshots/insights.png" width="22%" alt="Insights">
    <img src="docs/screenshots/inbox.png" width="22%" alt="Review inbox">
  </p>
-->

Finly started as a replacement for a Google Sheet used for monthly expense
tracking. The home screen answers one question without arithmetic: **how much can
I spend today?** Everything else — cards, rules, charts, payment detection — exists
to keep that answer right.

## Contents

- [Download](#download)
- [Features](#features)
- [Privacy architecture](#privacy-architecture)
- [Screenshots](#screenshots)
- [For developers](#for-developers)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Download

| Platform | How to get it |
| --- | --- |
| **Android** | [Google Play](https://play.google.com/store/apps/details?id=com.thecstudio.finly) — package `com.thecstudio.finly` |
| **iOS** | Not published. The code is cross-platform, so you can [build it yourself](#for-developers), but only Android is tested and supported. |
| **From source** | Clone the repo and follow [For developers](#for-developers). |

Finly updates through Google Play. It has no updater of its own and never checks for
one.

## Features

### Expense tracking

- **Amount-first entry.** The number pad opens on the amount, then item, category,
  account and date. *Save & add another* keeps the date and account.
- **Rules that fill the form.** Type "swiggy" and a rule sets the category, account
  and whether it counts toward the budget. Everything a rule filled is marked and
  stays editable, and the rule editor previews how many existing expenses it would
  match.
- **Accounts and credit cards.** Cash, bank, wallet and card accounts. Cards track
  a credit limit, statement day, cycle spend and utilisation, and can be anchored to
  what you owe so recorded bill payments bring the balance down.
- **Settlements, not edits.** When a friend pays you back, the expense stays intact
  and a linked settlement records the money returning. Partial and late repayments
  work, and the history is never rewritten.
- **Search and filters** by month, category, account and budget scope; swipe to
  delete with undo.
- **Transaction detection (optional).** Finly can read payment alerts from your SMS
  and banking or UPI apps and queue them in a review inbox. Nothing becomes an
  expense until you confirm it. You can also paste an alert, or share one from your
  messages app. If Finly misreads a format, tap the amount and payee to teach it.

### Budgeting

- **One monthly budget** with a *safe to spend today* ring on the home screen.
- **Carry-over.** Overspend rolls into next month and compounds; underspend does not
  get banked, so a frugal month can't license a blowout.
- **Off-budget spending.** Flag a one-off like a laptop as not counting toward the
  budget. It is still real spending and still counts against the card.
- **Daily reminder (optional)** to log expenses, skipped on days you already did.
- **Home-screen widget** showing this month's spend and how much budget is used.

### Analytics

Insights has four views: **spend by category**, **month-over-month against your
budget line**, **card utilisation**, and **top items and merchants**. The charts
count the budget only, and say so when a month has off-budget spend.

### Backups

There is no server holding a copy, so the backup is yours to keep.

- **Full backup (JSON)** restores everything — including what is in the bin — with
  the original ids.
- **Expenses (CSV)** for spreadsheets.
- **CSV import** with column mapping and a preview, so existing history comes
  across.
- Finly tracks when you last backed up and nudges you when it gets old.
- If a database migration ever fails, a recovery screen hands you the raw database
  file instead of a blank screen.

### Security

- **App lock** with fingerprint, face or device passcode (optional, off by default).
- **Database encryption** with SQLCipher (optional, off by default).
  [Details below](#optional-at-rest-encryption).

## Privacy architecture

> **Finly's own code makes no network requests.** There is no account, no server,
> no analytics, no advertising SDK and no crash reporter.

### What stays on your device

Everything you enter: transactions, accounts, categories, rules, budgets, settings,
and the payment alerts waiting in your review inbox. It lives in one SQLite
database in the app's private storage, which Android isolates from other apps.
Uninstalling the app deletes it. There is no copy elsewhere to delete.

### Does any feature make network requests?

No feature of Finly does. This table covers every feature that might look like it
reaches out:

| Feature | What actually happens |
| --- | --- |
| Transaction detection | Alerts are read and parsed on the device. A small on-device model (about 88 KB, shipped in the app) scores doubtful ones. Nothing is uploaded. |
| Contact the developer / Report a detection problem | Opens **your own mail app** with an email already written. You can read and edit it, and nothing is sent unless you press send there. Finly sends nothing itself. |
| Export and backup | The file is written on the device and handed to Android's share sheet. Where it goes is your choice, and from that point the destination app's privacy policy applies. |
| Import | Reads the file you pick. Not uploaded. |
| Daily reminder | A local notification scheduled on the device. No push service, no push token. |
| Widget | Reads the local database. |
| App lock | Android's biometric prompt returns a yes or no. Finly never sees your fingerprint, face or passcode. |
| Fonts, icons, charts | All bundled in the app. |

**A note on the `INTERNET` permission.** The generated Android manifest declares
`android.permission.INTERNET`, which comes from the React Native / Expo project
template (a development build needs it to reach the Metro bundler). No Finly code
uses it, and a search of `src/`, `modules/` and `plugins/` finds no `fetch`, no
`XMLHttpRequest` and no socket. You don't have to take our word for it: the source
is here, and the claim is checkable with a grep.

### What an email to the developer can contain

Only if you choose to send one. Each section can be switched off and is shown to you
first. It can include your app and Android version, phone make and model, language,
time zone, currency, and detection counts (alerts read, by which bank, how many
you corrected). Optionally, up to ten message *shapes* with every name, amount and
number replaced. It never contains your messages, amounts, balances, account or card
numbers, payees, categories, budget, or any device or install identifier.

### Permissions

| Permission | Why |
| --- | --- |
| Biometric / fingerprint | The optional app lock. |
| Notifications | The optional daily reminder, and a count of alerts awaiting review (never amounts or payees). |
| Notification access | **Optional.** A grant you give in Android's settings, used only for transaction detection. The listener is disabled until you switch detection on. |

Finly **does not request `READ_SMS` or `RECEIVE_SMS`.** It sees a bank SMS only
through the notification your SMS app posts, and only if you grant notification
access. Anything that doesn't look like a payment alert is discarded before it is
stored.

### Optional at-rest encryption

Off by default; turn it on in Settings → Security. The SQLCipher build ships either
way, because a SQLCipher binary with no key behaves as ordinary SQLite, which is
what lets encryption be switched on later without a native rebuild.

Encryption copies the database through `sqlcipher_export()` into a keyed file and
swaps them (`PRAGMA rekey` cannot encrypt a plaintext database). The connection is
a module-scope singleton, so switching it needs an app restart. **The key lives in
the device keychain and nowhere else.** If that is lost, an export is the only way
back.

The full policy is in [`docs/privacy/index.html`](docs/privacy/index.html).

## Screenshots

<!-- TODO: add screenshots or a short demo video; see the comment under the badge. -->

_Screenshots and a demo video are coming. Until then, the
[Play Store listing](https://play.google.com/store/apps/details?id=com.thecstudio.finly)
has the current ones._

## For developers

Built with Expo SDK 57, React Native, expo-router, `expo-sqlite` (SQLCipher) with
Drizzle ORM, and HeroUI Native on uniwind.

> Read the versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before
> writing code. Expo has changed.

The approved specification is [`plan docs/finly-mvp-plan.md`](plan%20docs/finly-mvp-plan.md)
— domain rules in §4, the schema in §5, screens in §7, milestones in §9. It is
the authority when this README and the spec disagree, and it is checked in for
exactly that reason.

### Prerequisites

- Node.js and **[pnpm](https://pnpm.io)**. Use pnpm only, never npm or npx.
- Android Studio with an SDK and an emulator or a device (for Android builds), or
  Xcode (for iOS).
- **Expo Go will not work.** `expo-sqlite` and the other native modules need a
  development build.

### Running it

```bash
pnpm install
pnpm android          # expo run:android, as the development variant
pnpm ios              # expo run:ios, as the development variant
```

The development build is a separate app — `Finly Dev`, `com.thecstudio.finly.dev`,
scheme `finly-dev` — so it installs beside the store app. The scripts set
`APP_VARIANT=development` for you; if you run `expo` directly, set it yourself.
It is built for `arm64-v8a` only, which every current phone runs; for an x86_64
emulator, build with `./gradlew assembleDebug -PreactNativeArchitectures=x86_64`.
The release build keeps every ABI.

The first run generates `android/` and `ios/` via prebuild. Both are gitignored,
so **any change to a native dependency or to the plugin list in `app.json` needs
a rebuild**:

```bash
pnpm native:dev      # pnpm native:prod before a release build
pnpm android
```

After changing `babel.config.js` or `metro.config.js`, clear the bundler cache:

```bash
pnpm start -c
```

### The database

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

### Checks

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

### Layout

```
src/
  app/          expo-router routes. Screens never touch the database.
  features/     hooks and draft↔row mappers, one folder per area.
  components/   shared presentational UI.
  db/           schema, the single connection, repositories, reactivity.
  domain/       pure functions. No React, no database, no clock.
  theme/        design tokens. The only place a color may be written.
modules/
  finly-capture/  native Android module for the notification listener.
```

Reads go through `useDbQuery` in `src/db/live.ts` — one hook, not two; the
reasoning is in that file. Writes go through `useAction`. Drizzle's expo driver
is synchronous, so repositories are too; `src/db/transaction.ts` explains what
that buys and what it costs.

### Money

Every amount is an integer number of minor units. ₹1,240.50 is `124050`, never
`1240.5`. `src/domain/money.ts` is the only place that formats one, and
`pnpm check:money` enforces that.

The display currency is a setting, chosen during onboarding and changeable in
Settings. It is **not** multi-currency, which the spec excludes: changing it
converts nothing, it only changes the symbol and how digits are grouped — ₹1,24,050
and $124,050 are the same stored integer.

### Invariants

These fail the build or review if broken:

- **Money is integer minor units**, formatted only by `src/domain/money.ts`.
- **Colours come from `src/theme/tokens.css`.** No literals anywhere else.
- **Screens never touch the database.** Screens call hooks, hooks call
  repositories, repositories are the only place SQL lives. `src/domain/` is pure.
- **All hooks above all early returns.**
- **Dates are derived in local time.** `toISOString` is banned in
  `src/domain/period.ts`.
- **Soft delete everywhere.** Every read filters `deleted_at`.
- **Release builds run R8.** Native code reached by reflection or JNI needs a keep
  rule in its own module's `proguard-rules.pro`, never in `android/`.
- **Never write `finly://` in code that builds a link.** Use `appScheme()`, so the
  dev build's links go to the dev build.

[`AGENTS.md`](AGENTS.md) has the reasoning behind each.

## Roadmap

Taken from §11 of the [plan](plan%20docs/finly-mvp-plan.md#11-after-the-mvp), in
order of expected value. Each is designed to land as an additive migration against
the existing schema.

- [ ] **Receipt attachments**
- [ ] **Recurring expenses**, to forecast the fixed monthly base
- [ ] **Income and balances**
- [ ] **People and lending**, turning settlements into a per-person ledger
- [ ] **EMI plans**
- [ ] **Per-category budgets**
- [ ] **Rules v2**: amount and date conditions, alert actions, auto-tagging
- [ ] **Sync**: UUIDs, `updated_at` and `deleted_at` are already in place. If this
      ever ships it will be optional and the privacy policy will change first.
- [x] ~~Card payments and true utilisation~~
- [x] ~~Transaction detection with a review inbox~~

Not on the roadmap: ads, analytics, or any account requirement.

Ideas and requests are welcome as [issues](https://github.com/sreekanth666/finly/issues).

## Contributing

Bug reports, fixes and doc improvements are welcome.

1. **Open an issue first** for anything bigger than a small fix, so the approach can
   be agreed before you write it.
2. Fork, then branch from an up-to-date `main`.
3. Read [Invariants](#invariants) and `plan docs/finly-mvp-plan.md`. A change that
   conflicts with the plan needs the plan changed, with a new decision entry saying
   why.
4. **Run `pnpm check`** (typecheck, lint, tests, colour and money checks). It must
   pass, and it never mutates the repo. `pnpm lint` currently reports 8 React
   Compiler warnings, which are the known baseline.
5. Write [conventional commits](https://www.conventionalcommits.org/) such as
   `feat(categories): …` or `fix(data-transfer): …`, then open a pull request
   against `main` describing what changed and why.

Please don't add network code, analytics, or tracking of any kind: the no-network
promise is the product.
Changes that touch the notification listener or detection need extra care, since
they handle the most sensitive text in the app. If you can only verify a change on
a physical device, say so in the PR.

## Security

**Please don't open a public issue for a security vulnerability.** Email
**srekthk1@gmail.com** with "Finly security" in the subject, and include the app
version (Settings → About), your Android version, and steps to reproduce. You will
get an acknowledgement, and a fix will be credited to you unless you'd rather it
wasn't.

Especially in scope: anything that lets another app read the database, a backup or
an export; a way to bypass the app lock; flaws in database encryption or key
handling; anything that causes alert text to leave the device; and the
notification listener or share-target handling.

Supported version: the latest release on Google Play.

## License

[MIT](LICENSE).
