/**
 * Turning raw messages into inbox candidates (D17).
 *
 * One path for every source — pasted text, a shared message, the notification
 * listener's queue — so a message reads the same however it arrived. The pure
 * work (reading, suggesting, keying) is done here, outside any transaction;
 * the repository only writes.
 *
 * Batches are chunked with a yield between them and the screens woken once at
 * the end, the same way CSV import does it, so a listener that has been
 * queueing for a week cannot lock the UI while it drains.
 */

import { db, type DbLike } from '@/db/client';
import { withSuppressedInvalidation } from '@/db/live';
import { listAccounts } from '@/db/repositories/accounts';
import {
  applyReparse,
  ingestCaptures,
  listReparseTargets,
  purgeCaptures,
  type IngestOutcome,
  type PreparedCapture,
  type RawCapture,
} from '@/db/repositories/captures';
import { listCategories } from '@/db/repositories/categories';
import { listActiveRules } from '@/db/repositories/rules';
import { getProfileName, getSetting, setSetting } from '@/db/repositories/settings';
import { yieldToUi } from '@/db/transaction';
import {
  captureKey,
  DEFAULT_RETENTION_DAYS,
  detect,
  PARSER_VERSION,
  suggest,
  type Detection,
  type SuggestContext,
} from '@/domain/txn-detect';

const CHUNK = 100;
const MS_PER_DAY = 86_400_000;

type Context = { suggest: SuggestContext; ownerName: string | null };

function readContext(database: DbLike): Context {
  return {
    suggest: {
      rules: listActiveRules(database),
      categories: listCategories({ includeArchived: true }, database),
      accounts: listAccounts({ includeArchived: true }, database),
    },
    ownerName: getProfileName(database),
  };
}

/**
 * The detector is total over every input the tests throw at it, but a message
 * that somehow breaks it must still be kept — "never discard" is the promise —
 * so a failure becomes an unread candidate rather than a lost one.
 */
function safeDetect(raw: RawCapture, ownerName: string | null): Detection {
  try {
    return detect(raw, { ownerName });
  } catch {
    return { ...detect({ body: '', receivedAt: raw.receivedAt }), reasons: ['parser:error'] };
  }
}

function prepare(raw: RawCapture, context: Context): PreparedCapture {
  const detection = safeDetect(raw, context.ownerName);
  return {
    ...raw,
    contentHash: captureKey(raw),
    detection,
    suggestion: suggest(detection, context.suggest),
  };
}

export async function ingest(raws: readonly RawCapture[], database: DbLike = db): Promise<IngestOutcome[]> {
  if (raws.length === 0) return [];
  const context = readContext(database);
  const outcomes: IngestOutcome[] = [];

  await withSuppressedInvalidation(async () => {
    for (let index = 0; index < raws.length; index += CHUNK) {
      const batch = raws.slice(index, index + CHUNK).map((raw) => prepare(raw, context));
      outcomes.push(...ingestCaptures(batch, PARSER_VERSION, database));
      await yieldToUi();
    }
  });

  return outcomes;
}

/**
 * A message the user pasted or shared to Finly. Returns the candidate it
 * became, or already was — pasting the same message twice is one candidate.
 */
export async function ingestText(
  text: string,
  source: 'paste' | 'share',
  now: number = Date.now(),
): Promise<IngestOutcome | null> {
  const body = text.trim();
  if (body.length === 0) return null;
  const [outcome] = await ingest([
    { source, packageName: null, sender: null, title: null, body, postedAt: now, receivedAt: now },
  ]);
  return outcome ?? null;
}

/**
 * Re-reads pending candidates a previous parser version read, once per upgrade.
 * Candidates the user has touched are left as they are.
 */
export async function reparseIfStale(database: DbLike = db): Promise<void> {
  if (getSetting('capture_parser_version', database) === String(PARSER_VERSION)) return;

  const context = readContext(database);
  let isFinished = false;
  await withSuppressedInvalidation(async () => {
    /* Bounded per pass, so an upgrade can never spin. A backlog bigger than
       one pass is finished by the next one — the version is only recorded
       once nothing is left, or the rest would keep the old reading forever. */
    for (let round = 0; round < 50; round += 1) {
      const targets = listReparseTargets(PARSER_VERSION, CHUNK, database);
      if (targets.length === 0) {
        isFinished = true;
        break;
      }
      applyReparse(
        targets.map((target) => {
          const detection = safeDetect(target, context.ownerName);
          return { id: target.id, detection, suggestion: suggest(detection, context.suggest) };
        }),
        PARSER_VERSION,
        database,
      );
      await yieldToUi();
    }
  });

  if (isFinished) setSetting('capture_parser_version', String(PARSER_VERSION), database);
}

export function retentionDays(database: DbLike = db): number {
  const stored = Number(getSetting('capture_retention_days', database));
  return Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_RETENTION_DAYS;
}

/** Clears message text past its retention. Cheap when there is nothing to clear. */
export function purgeExpired(now: number = Date.now(), database: DbLike = db): number {
  return purgeCaptures(now - retentionDays(database) * MS_PER_DAY, database);
}
