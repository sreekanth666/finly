/**
 * Message formats the user taught (D18).
 *
 * Every write bumps `capture_templates_rev` inside its own transaction, which
 * is what tells the re-read to look at pending candidates again: teach a
 * format and the alert you taught it from is re-read with it; delete one and
 * what it read goes back to the generic reading.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import {
  checkTemplate,
  decodeSegments,
  encodeSegments,
  type Segment,
  type TemplateBinding,
  type TemplateOutcome,
  type TemplateSpec,
} from '@/domain/txn-detect';

import { db, type DbLike } from '../client';
import { NotFoundError, ValidationError } from '../errors';
import { newId } from '../id';
import { captureTemplates, type CaptureTemplateRow, type DetectionKindColumn } from '../schema';
import { writeTransaction } from '../transaction';
import { getSetting, setSetting } from './settings';

const alive = isNull(captureTemplates.deletedAt);

/* -------------------------------------------------------------------------- */
/* The revision                                                                 */
/* -------------------------------------------------------------------------- */

export function templatesRev(database: DbLike = db): number {
  const stored = Number(getSetting('capture_templates_rev', database));
  return Number.isInteger(stored) && stored > 0 ? stored : 0;
}

const bumpRev = (tx: DbLike) => setSetting('capture_templates_rev', String(templatesRev(tx) + 1), tx);

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

export type TemplateListItem = {
  id: string;
  name: string;
  binding: TemplateBinding;
  outcome: TemplateOutcome;
  direction: 'debit' | 'credit' | null;
  overridesGate: DetectionKindColumn | null;
  segments: Segment[];
  sampleMasked: string;
  timesMatched: number;
  lastMatchedAt: number | null;
  isEnabled: boolean;
  updatedAt: number;
};

const parseSegments = (json: string): Segment[] | null => {
  try {
    return decodeSegments(JSON.parse(json));
  } catch {
    return null;
  }
};

/** Null for a row whose segments do not decode — a restored backup can carry anything. */
function toItem(row: CaptureTemplateRow): TemplateListItem | null {
  const segments = parseSegments(row.segments);
  if (segments === null) return null;
  return {
    id: row.id,
    name: row.name,
    binding: { senderKey: row.senderKey, packageName: row.packageName, issuer: row.issuer },
    outcome: row.outcome,
    direction: row.direction,
    overridesGate: row.overridesGate,
    segments,
    sampleMasked: row.sampleMasked,
    timesMatched: row.timesMatched,
    lastMatchedAt: row.lastMatchedAt,
    isEnabled: row.isEnabled,
    updatedAt: row.updatedAt,
  };
}

export const listTemplates = (database: DbLike = db): TemplateListItem[] =>
  database
    .select()
    .from(captureTemplates)
    .where(alive)
    .orderBy(desc(captureTemplates.updatedAt))
    .all()
    .map(toItem)
    .filter((item): item is TemplateListItem => item !== null);

export function getTemplate(id: string, database: DbLike = db): TemplateListItem | null {
  const row = database
    .select()
    .from(captureTemplates)
    .where(and(eq(captureTemplates.id, id), alive))
    .get();
  return row === undefined ? null : toItem(row);
}

export const toSpec = (item: TemplateListItem): TemplateSpec => ({
  id: item.id,
  name: item.name,
  binding: item.binding,
  outcome: item.outcome,
  direction: item.direction,
  overridesGate: item.overridesGate,
  segments: item.segments,
  updatedAt: item.updatedAt,
});

/** What the detector is given: every enabled template that decodes. */
export const listEnabledSpecs = (database: DbLike = db): TemplateSpec[] =>
  listTemplates(database)
    .filter((item) => item.isEnabled)
    .map(toSpec);

/* -------------------------------------------------------------------------- */
/* Writes                                                                       */
/* -------------------------------------------------------------------------- */

export type TemplateInput = {
  name: string;
  binding: TemplateBinding;
  outcome: TemplateOutcome;
  direction: 'debit' | 'credit' | null;
  overridesGate: DetectionKindColumn | null;
  segments: Segment[];
  /** Already masked by the caller — see `maskMessage`. */
  sampleMasked: string;
};

function validate(input: TemplateInput): void {
  const name = input.name.trim();
  if (name.length === 0) throw new ValidationError('name', 'Give this format a name.');
  const { errors } = checkTemplate({
    id: 'check',
    name,
    binding: input.binding,
    outcome: input.outcome,
    direction: input.direction,
    overridesGate: input.overridesGate,
    segments: input.segments,
    updatedAt: 0,
  });
  if (errors.length > 0) throw new ValidationError('template', errors[0]);
}

const columns = (input: TemplateInput) => ({
  name: input.name.trim(),
  senderKey: input.binding.senderKey,
  packageName: input.binding.packageName,
  issuer: input.binding.issuer,
  outcome: input.outcome,
  direction: input.outcome === 'ignore' ? null : input.direction,
  overridesGate: input.overridesGate,
  segments: JSON.stringify(encodeSegments(input.segments)),
  sampleMasked: input.sampleMasked,
});

export function createTemplate(input: TemplateInput, database: DbLike = db): string {
  validate(input);
  const id = newId();
  const now = Date.now();
  writeTransaction((tx) => {
    tx.insert(captureTemplates)
      .values({ id, ...columns(input), createdAt: now, updatedAt: now })
      .run();
    bumpRev(tx);
  }, database);
  return id;
}

export function updateTemplate(id: string, input: TemplateInput, database: DbLike = db): void {
  validate(input);
  writeTransaction((tx) => {
    const existing = tx.select({ id: captureTemplates.id }).from(captureTemplates).where(and(eq(captureTemplates.id, id), alive)).get();
    if (existing === undefined) throw new NotFoundError('Template', id);
    tx.update(captureTemplates)
      .set({ ...columns(input), updatedAt: Date.now() })
      .where(eq(captureTemplates.id, id))
      .run();
    bumpRev(tx);
  }, database);
}

export function setTemplateEnabled(id: string, isEnabled: boolean, database: DbLike = db): void {
  writeTransaction((tx) => {
    tx.update(captureTemplates)
      .set({ isEnabled, updatedAt: Date.now() })
      .where(and(eq(captureTemplates.id, id), alive))
      .run();
    bumpRev(tx);
  }, database);
}

export function softDeleteTemplate(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    tx.update(captureTemplates)
      .set({ deletedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(captureTemplates.id, id))
      .run();
    bumpRev(tx);
  }, database);
}

/** The undo behind the swipe. */
export function restoreTemplate(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    tx.update(captureTemplates)
      .set({ deletedAt: null, updatedAt: Date.now() })
      .where(eq(captureTemplates.id, id))
      .run();
    bumpRev(tx);
  }, database);
}

/**
 * Counts how often each template read something, for "used N times" on the
 * list. Does not bump the rev: it changes nothing any template would read.
 */
export function recordTemplateMatches(counts: ReadonlyMap<string, number>, database: DbLike = db): void {
  if (counts.size === 0) return;
  const now = Date.now();
  writeTransaction((tx) => {
    for (const [id, times] of counts) {
      tx.update(captureTemplates)
        .set({ timesMatched: sql`${captureTemplates.timesMatched} + ${times}`, lastMatchedAt: now })
        .where(eq(captureTemplates.id, id))
        .run();
    }
  }, database);
}
