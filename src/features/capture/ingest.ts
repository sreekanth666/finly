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
 *
 * Formats the user taught (D18) are loaded and compiled once per pass and
 * handed to the detector; every candidate records which set of them it was
 * read with, so teaching or removing one re-reads what is still pending.
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
import { listEnabledSpecs, recordTemplateMatches, templatesRev } from '@/db/repositories/templates';
import { yieldToUi } from '@/db/transaction';
import {
  captureKey,
  compileTemplate,
  DEFAULT_RETENTION_DAYS,
  detect,
  orderTemplates,
  PARSER_VERSION,
  suggest,
  templateIdOf,
  type CompiledTemplate,
  type Detection,
  type SuggestContext,
} from '@/domain/txn-detect';

const CHUNK = 100;
const MS_PER_DAY = 86_400_000;

type Context = {
  suggest: SuggestContext;
  ownerName: string | null;
  templates: CompiledTemplate[];
  templatesRev: number;
};

/** Every enabled template, compiled and in the order they are tried. */
export function loadTemplates(database: DbLike = db): CompiledTemplate[] {
  return orderTemplates(
    listEnabledSpecs(database)
      .map(compileTemplate)
      .filter((template): template is CompiledTemplate => template !== null),
  );
}

function readContext(database: DbLike): Context {
  return {
    suggest: {
      rules: listActiveRules(database),
      categories: listCategories({ includeArchived: true }, database),
      accounts: listAccounts({ includeArchived: true }, database),
    },
    ownerName: getProfileName(database),
    templates: loadTemplates(database),
    templatesRev: templatesRev(database),
  };
}

/**
 * The detector is total over every input the tests throw at it, but a message
 * that somehow breaks it must still be kept — "never discard" is the promise —
 * so a failure becomes an unread candidate rather than a lost one.
 */
function safeDetect(raw: RawCapture, context: Context): Detection {
  try {
    return detect(raw, { ownerName: context.ownerName, templates: context.templates });
  } catch {
    return { ...detect({ body: '', receivedAt: raw.receivedAt }), reasons: ['parser:error'] };
  }
}

function prepare(raw: RawCapture, context: Context): PreparedCapture {
  const detection = safeDetect(raw, context);
  return {
    ...raw,
    contentHash: captureKey(raw),
    detection,
    suggestion: suggest(detection, context.suggest),
  };
}

/** How many times each template read something in a batch. */
function countMatches(detections: readonly Detection[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const detection of detections) {
    const id = templateIdOf(detection.reasons);
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function ingest(raws: readonly RawCapture[], database: DbLike = db): Promise<IngestOutcome[]> {
  if (raws.length === 0) return [];
  const context = readContext(database);
  const outcomes: IngestOutcome[] = [];

  await withSuppressedInvalidation(async () => {
    for (let index = 0; index < raws.length; index += CHUNK) {
      const batch = raws.slice(index, index + CHUNK).map((raw) => prepare(raw, context));
      const results = ingestCaptures(
        batch,
        { parserVersion: PARSER_VERSION, templatesRev: context.templatesRev },
        database,
      );
      outcomes.push(...results);
      recordTemplateMatches(
        countMatches(batch.filter((_, position) => results[position]?.status !== 'seen').map((item) => item.detection)),
        database,
      );
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

const isCurrent = (database: DbLike) =>
  getSetting('capture_parser_version', database) === String(PARSER_VERSION) &&
  getSetting('capture_templates_done_rev', database) === String(templatesRev(database));

/**
 * One pass of re-reading. Bounded, so it can never spin; a backlog bigger than
 * one pass is finished by the next. Each marker is only recorded once nothing
 * is left, or the rest would keep the old reading forever.
 */
async function reparseOnce(database: DbLike): Promise<void> {
  if (isCurrent(database)) return;

  const context = readContext(database);
  let isFinished = false;
  await withSuppressedInvalidation(async () => {
    for (let round = 0; round < 50; round += 1) {
      const targets = listReparseTargets(PARSER_VERSION, context.templatesRev, CHUNK, database);
      if (targets.length === 0) {
        isFinished = true;
        break;
      }
      const updates = targets.map((target) => {
        const detection = safeDetect(target, context);
        return { id: target.id, detection, suggestion: suggest(detection, context.suggest) };
      });
      applyReparse(updates, PARSER_VERSION, context.templatesRev, database);
      await yieldToUi();
    }
  });

  if (isFinished) {
    setSetting('capture_parser_version', String(PARSER_VERSION), database);
    setSetting('capture_templates_done_rev', String(context.templatesRev), database);
  }
}

let reparsing: Promise<void> | null = null;
let isWanted = false;

/**
 * Re-reads pending candidates when the parser has been upgraded or the taught
 * templates have changed. Candidates the user has touched are left as they
 * are. Saving a template calls this directly; a call that arrives while a pass
 * is running asks for one more pass rather than running alongside it.
 */
export function reparseIfStale(database: DbLike = db): Promise<void> {
  if (reparsing !== null) {
    isWanted = true;
    return reparsing;
  }
  reparsing = (async () => {
    do {
      isWanted = false;
      await reparseOnce(database);
    } while (isWanted);
  })().finally(() => {
    reparsing = null;
  });
  return reparsing;
}

export function retentionDays(database: DbLike = db): number {
  const stored = Number(getSetting('capture_retention_days', database));
  return Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_RETENTION_DAYS;
}

/** Clears message text past its retention. Cheap when there is nothing to clear. */
export function purgeExpired(now: number = Date.now(), database: DbLike = db): number {
  return purgeCaptures(now - retentionDays(database) * MS_PER_DAY, database);
}
