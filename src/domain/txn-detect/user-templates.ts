/**
 * Message formats the user taught Finly (D18).
 *
 * The generic reader in this folder handles most alerts, but India has
 * hundreds of issuers and they change their wording. When one is misread, the
 * user fixes it by example: they tap which part of a real message is the
 * amount, which is the payee, and so on. Everything else — turning that into a
 * pattern — happens here. Nobody ever writes or sees a regular expression.
 *
 * The shape of a template, and why:
 *
 * - **Tokens, not words.** Bank alerts glue fields to punctuation:
 *   `UPI/P2M/624512345678/ZOMATO`, `(UPI 625325710634)`, `A/C *6630`. The
 *   lexer splits letters, digits and each punctuation mark apart, remembering
 *   which were glued, so any piece can be tapped.
 * - **Only what is near a field is kept.** A few words either side of each
 *   tagged field become anchors; the rest collapses into a bounded gap. Long
 *   boilerplate tails ("Call 18002662 for dispute") are dropped, so a bank
 *   tweaking its footer does not break the template.
 * - **Things that vary are wildcards.** Every untagged number (balances,
 *   references, dates) and every month, weekday and AM/PM becomes a wildcard,
 *   so the template matches next month's message, not only this one.
 * - **Lines are kept.** Several banks put one field per line, and the line
 *   break is what ends a payee's name. Payee captures never cross a line.
 * - **Every gap is bounded.** This runs on every captured notification, so no
 *   pattern here may backtrack without limit.
 *
 * Safety comes from three rules enforced at match time, not from hoping the
 * pattern is narrow: a template only ever applies to messages from the sender
 * it was taught on; it can only overrule the one negative gate its own sample
 * tripped (so a template taught on a statement never claims an OTP); and a
 * match whose amount does not parse is no match. A template that does not
 * match changes nothing.
 */

import { parseMinor, type Minor } from '@/domain/money';

import { labelOf } from './counterparty';
import { CURRENCY_CODES } from './normalise';
import { isSmsApp, resolveIssuer, senderHeader } from './sources';
import type { DetectionKind, Direction } from './types';

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_FIELDS = ['amount', 'counterparty', 'reference', 'tail'] as const;
export type TemplateField = (typeof TEMPLATE_FIELDS)[number];

export const TEMPLATE_OUTCOMES = ['transaction', 'transfer', 'ignore'] as const;
/** What a matching message is: spending (or money in), a transfer, or noise to mute. */
export type TemplateOutcome = (typeof TEMPLATE_OUTCOMES)[number];

/** Who a template belongs to. At least one is set, or it cannot be saved. */
export type TemplateBinding = {
  /** The six-letter DLT header, e.g. `HDFCBK` — the strongest binding. */
  senderKey: string | null;
  /** A payment app that posts its own alerts. Never an SMS app. */
  packageName: string | null;
  issuer: string | null;
};

export type Segment =
  | { type: 'anchor'; text: string; glued: boolean }
  | { type: 'field'; field: TemplateField; glued: boolean }
  /** Any run of digits — a balance, a reference nobody tagged, a date part. */
  | { type: 'number'; glued: boolean }
  /** A word that changes between messages: a month, a weekday, AM or PM. */
  | { type: 'word'; glued: boolean }
  /** Text between two fields that nobody needs, collapsed. */
  | { type: 'gap'; sameLine: boolean; glued: boolean }
  | { type: 'newline'; glued: boolean };

export type TemplateSpec = {
  id: string;
  name: string;
  binding: TemplateBinding;
  outcome: TemplateOutcome;
  direction: Direction | null;
  /** The negative kind the sample was filed as, which this template may overrule. */
  overridesGate: DetectionKind | null;
  segments: Segment[];
  /** For ordering: among equal templates, the newest wins. */
  updatedAt: number;
};

/** What a match read. Null fields were not tagged, and the generic reader fills them. */
export type TemplateMatch = {
  templateId: string;
  outcome: TemplateOutcome;
  direction: Direction | null;
  amountMinor: Minor | null;
  currency: string | null;
  counterparty: string | null;
  reference: string | null;
  tail: string | null;
};

export type CompiledTemplate = {
  spec: TemplateSpec;
  /** Lower-cased; must appear in the message before the pattern is even tried. */
  prefilter: string | null;
  /** Total length of all anchors — more specific templates are tried first. */
  weight: number;
  pattern: RegExp;
  /** Which capture group holds each field. */
  groups: Partial<Record<TemplateField | 'currency', number>>;
};

/* -------------------------------------------------------------------------- */
/* Lexer                                                                        */
/* -------------------------------------------------------------------------- */

export type TokenKind = 'word' | 'number' | 'punct' | 'newline';

export type Token = {
  text: string;
  kind: TokenKind;
  /** Offsets into the normalised text. */
  start: number;
  end: number;
  /** No whitespace between this token and the one before it. */
  glued: boolean;
};

const TOKEN = /\n|[A-Za-z]+|[0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?|[^\sA-Za-z0-9]/g;

/**
 * Splits normalised text into the pieces a person can tap. "1,02,000.50" stays
 * one number; "A/C" is three pieces; a line break is a piece of its own.
 */
export function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  let previousEnd = 0;
  for (const match of text.matchAll(TOKEN)) {
    const value = match[0];
    const kind: TokenKind =
      value === '\n' ? 'newline' : /^[A-Za-z]/.test(value) ? 'word' : /^[0-9]/.test(value) ? 'number' : 'punct';
    tokens.push({
      text: value,
      kind,
      start: match.index,
      end: match.index + value.length,
      glued: tokens.length > 0 && match.index === previousEnd,
    });
    previousEnd = match.index + value.length;
  }
  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Binding                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Who a message is from, in the terms a template binds to. An SMS app's
 * package is deliberately not a binding: every SMS on the phone shares it.
 */
export function bindingOf(message: {
  sender?: string | null;
  title?: string | null;
  packageName?: string | null;
  body: string;
}): TemplateBinding {
  const packageName = message.packageName ?? null;
  return {
    senderKey: senderHeader(message.sender) ?? senderHeader(message.title),
    packageName: packageName !== null && !isSmsApp(packageName) ? packageName : null,
    issuer: resolveIssuer({ sender: message.sender, title: message.title, body: message.body }),
  };
}

export const hasBinding = (binding: TemplateBinding): boolean =>
  binding.senderKey !== null || binding.packageName !== null || binding.issuer !== null;

/**
 * Whether a template may be tried on a message. The sender id decides when
 * both have one. The issuer stands in only when one side has no sender id —
 * a pasted message, or a template taught from one — so an HDFC template never
 * claims an SBI alert that happens to mention HDFC.
 */
export function bindingApplies(template: TemplateBinding, message: TemplateBinding): boolean {
  if (template.senderKey !== null && template.senderKey === message.senderKey) return true;
  if (template.packageName !== null && template.packageName === message.packageName) return true;
  if (
    template.issuer !== null &&
    template.issuer === message.issuer &&
    (template.senderKey === null || message.senderKey === null)
  ) {
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Deriving a template from a tagged example                                    */
/* -------------------------------------------------------------------------- */

/** A tagged span, in token indices: `start` inclusive, `end` exclusive. */
export type Tag = { field: TemplateField; start: number; end: number };

const VARIABLE_WORDS = new Set([
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october',
  'november', 'december', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'am', 'pm', 'ist',
]);

const isCurrencyToken = (token: Token | undefined) =>
  token !== undefined && token.kind === 'word' && (CURRENCY_CODES as readonly string[]).includes(token.text.toUpperCase());

type Unit =
  | { kind: 'field'; field: TemplateField; glued: boolean }
  | { kind: 'anchor'; text: string; isWord: boolean; glued: boolean }
  | { kind: 'number'; glued: boolean }
  | { kind: 'word'; glued: boolean }
  | { kind: 'newline'; glued: boolean };

/** Words kept on each side of a field. More makes a template stricter, and more brittle. */
const WORDS_BEFORE = 2;
const WORDS_AFTER = 2;
const WORDS_AFTER_LAST = 1;
/** A template with no fields (a mute) keeps this much of the message. */
const MUTE_UNITS = 40;

function unitsOf(tokens: readonly Token[], tags: readonly Tag[]): Unit[] {
  /* Tapping a figure takes its currency mark with it: "INR" and "500.00" are
     two tokens after normalising, but one amount. */
  const spans = tags.map((tag) =>
    tag.field === 'amount' && isCurrencyToken(tokens[tag.start - 1]) ? { ...tag, start: tag.start - 1 } : tag,
  );
  const fieldAt = new Map<number, Tag>();
  for (const span of spans) {
    for (let index = Math.max(0, span.start); index < Math.min(tokens.length, span.end); index += 1) {
      fieldAt.set(index, span);
    }
  }

  const units: Unit[] = [];
  let current: Tag | null = null;
  tokens.forEach((token, index) => {
    const span = fieldAt.get(index) ?? null;
    if (span !== null) {
      if (span !== current) units.push({ kind: 'field', field: span.field, glued: token.glued });
      current = span;
      return;
    }
    current = null;
    if (token.kind === 'newline') units.push({ kind: 'newline', glued: token.glued });
    else if (token.kind === 'number') units.push({ kind: 'number', glued: token.glued });
    else if (token.kind === 'word' && VARIABLE_WORDS.has(token.text.toLowerCase())) {
      units.push({ kind: 'word', glued: token.glued });
    } else {
      units.push({ kind: 'anchor', text: token.text, isWord: token.kind === 'word', glued: token.glued });
    }
  });
  return units;
}

const isCountedWord = (unit: Unit) => unit.kind === 'anchor' && unit.isWord;

/** How far from `from`, stepping by `step`, until `words` anchor words are included. */
function reach(units: readonly Unit[], from: number, step: 1 | -1, words: number, stopAtNewline: boolean): number {
  let counted = 0;
  let index = from;
  while (index + step >= 0 && index + step < units.length) {
    const next = units[index + step];
    if (next.kind === 'field') break;
    index += step;
    if (isCountedWord(next)) counted += 1;
    if (counted >= words) break;
    if (stopAtNewline && next.kind === 'newline') break;
  }
  return index;
}

const toSegment = (unit: Unit): Segment => {
  switch (unit.kind) {
    case 'field':
      return { type: 'field', field: unit.field, glued: unit.glued };
    case 'anchor':
      return { type: 'anchor', text: unit.text, glued: unit.glued };
    case 'number':
      return { type: 'number', glued: unit.glued };
    case 'word':
      return { type: 'word', glued: unit.glued };
    case 'newline':
      return { type: 'newline', glued: unit.glued };
  }
};

/**
 * The segments for a tagged example: the fields, a few words either side of
 * each, and bounded gaps where the example had text nobody needs.
 */
export function deriveSegments(text: string, tags: readonly Tag[]): Segment[] {
  const units = unitsOf(tokenise(text), tags);
  const fieldIndexes = units.flatMap((unit, index) => (unit.kind === 'field' ? [index] : []));

  if (fieldIndexes.length === 0) {
    return units.slice(0, MUTE_UNITS).map(toSegment);
  }

  const keep = new Array<boolean>(units.length).fill(false);
  const markRange = (from: number, to: number) => {
    for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) keep[index] = true;
  };

  const first = fieldIndexes[0];
  const last = fieldIndexes[fieldIndexes.length - 1];
  markRange(reach(units, first, -1, WORDS_BEFORE, false), first);
  markRange(last, reach(units, last, 1, WORDS_AFTER_LAST, true));

  for (let position = 0; position < fieldIndexes.length - 1; position += 1) {
    const left = fieldIndexes[position];
    const right = fieldIndexes[position + 1];
    markRange(left, reach(units, left, 1, WORDS_AFTER, false));
    markRange(reach(units, right, -1, WORDS_BEFORE, false), right);
  }

  const segments: Segment[] = [];
  let skipped: Unit[] = [];
  let started = false;
  units.forEach((unit, index) => {
    if (keep[index]) {
      if (started && skipped.length > 0) {
        segments.push({
          type: 'gap',
          sameLine: !skipped.some((skip) => skip.kind === 'newline'),
          glued: skipped[0].glued,
        });
      }
      skipped = [];
      started = true;
      segments.push(toSegment(unit));
    } else if (started) {
      skipped.push(unit);
    }
  });

  /* The pattern is unanchored, so a leading line break says nothing. */
  while (segments.length > 0 && segments[0].type === 'newline') segments.shift();
  return segments;
}

/* -------------------------------------------------------------------------- */
/* Compiling                                                                    */
/* -------------------------------------------------------------------------- */

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

const CURRENCY_GROUP = `(${CURRENCY_CODES.join('|')})`;

/** One regular expression for a template. Null when the segments cannot make one. */
export function compileTemplate(spec: TemplateSpec): CompiledTemplate | null {
  const segments = spec.segments;
  if (segments.length === 0) return null;

  let source = '';
  let group = 0;
  const groups: CompiledTemplate['groups'] = {};
  let weight = 0;
  let prefilter: string | null = null;

  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    if (index > 0 && segment.type !== 'newline' && previous.type !== 'newline') {
      source += segment.glued ? '\\s*' : '\\s+';
    }

    switch (segment.type) {
      case 'anchor': {
        source += escape(segment.text);
        weight += segment.text.length;
        if (/^[A-Za-z]{3,}$/.test(segment.text) && (prefilter === null || segment.text.length > prefilter.length)) {
          prefilter = segment.text.toLowerCase();
        }
        break;
      }
      case 'number':
        source += '\\d[\\d,.]*';
        break;
      case 'word':
        source += '[A-Za-z]{2,9}';
        break;
      case 'gap':
        source += segment.sameLine ? '[^\\n]{0,80}?' : '[\\s\\S]{0,200}?';
        break;
      case 'newline':
        source += '[ \\t]*\\n[ \\t]*';
        break;
      case 'field': {
        if (groups[segment.field] !== undefined) return;
        switch (segment.field) {
          case 'amount':
            source += `(?:${CURRENCY_GROUP}\\s?)?([0-9][0-9,]*(?:\\.[0-9]+)?)`;
            groups.currency = ++group;
            groups.amount = ++group;
            break;
          case 'counterparty': {
            source += '([^\\n]{1,60}?)';
            groups.counterparty = ++group;
            /* A payee at the very end is bounded by the end of its line, or a
               lazy capture would stop after one character. */
            if (index === segments.length - 1) source += '(?=[ \\t]*(?:\\n|$))';
            break;
          }
          case 'reference':
            source += '([A-Za-z0-9]*[0-9][A-Za-z0-9]*)';
            groups.reference = ++group;
            break;
          case 'tail':
            source += '(\\d{2,6})';
            groups.tail = ++group;
            break;
        }
        break;
      }
    }
  });

  try {
    return { spec, prefilter, weight, pattern: new RegExp(source, 'i'), groups };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Matching                                                                     */
/* -------------------------------------------------------------------------- */

/** No bank alert is this long; anything longer is not worth a pattern's time. */
const MAX_TEXT = 1000;

/**
 * Kinds a template may only overrule when its own sample was filed as that
 * kind. Everything the classifier sets aside — and the transfers, which keep a
 * card bill from counting twice — is here. A plain transaction is not: a
 * template may always refine one.
 */
const GATED_KINDS: readonly DetectionKind[] = [
  'transfer',
  'refund',
  'failed',
  'upcoming',
  'statement',
  'otp',
  'balance',
  'promo',
  'reminder',
];

export const isGatedKind = (kind: DetectionKind): boolean => GATED_KINDS.includes(kind);

/** Most specific first, then newest — deterministic, with nothing for anyone to configure. */
export const orderTemplates = (templates: readonly CompiledTemplate[]): CompiledTemplate[] =>
  [...templates].sort((a, b) => b.weight - a.weight || b.spec.updatedAt - a.spec.updatedAt);

function readMatch(template: CompiledTemplate, text: string): TemplateMatch | null {
  const found = template.pattern.exec(text);
  if (found === null) return null;
  const at = (field: TemplateField | 'currency') => {
    const index = template.groups[field];
    return index === undefined ? null : (found[index] ?? null);
  };

  let amountMinor: Minor | null = null;
  const amountText = at('amount');
  if (template.groups.amount !== undefined) {
    amountMinor = amountText === null ? null : parseMinor(amountText);
    /* A figure that does not parse means the pattern landed somewhere else. */
    if (amountMinor === null || amountMinor <= 0) return null;
  }

  let counterparty: string | null = null;
  if (template.groups.counterparty !== undefined) {
    const raw = (at('counterparty') ?? '').replace(/\s+/g, ' ').trim();
    if (raw.length === 0 || labelOf(raw) === null) return null;
    counterparty = raw;
  }

  const reference = at('reference');
  if (template.groups.reference !== undefined && (reference === null || reference.length < 6)) return null;

  return {
    templateId: template.spec.id,
    outcome: template.spec.outcome,
    direction: template.spec.direction,
    amountMinor,
    currency: template.groups.amount === undefined ? null : (at('currency')?.toUpperCase() ?? 'INR'),
    counterparty,
    reference: reference === null ? null : reference.toUpperCase(),
    tail: at('tail'),
  };
}

/**
 * The first template that reads this message, or null. `classified` is what
 * the generic classifier made of it, for the gate rule.
 */
export function matchTemplates(
  templates: readonly CompiledTemplate[],
  message: { text: string; binding: TemplateBinding; classified: DetectionKind },
): TemplateMatch | null {
  if (templates.length === 0 || message.text.length > MAX_TEXT) return null;
  const lowered = message.text.toLowerCase();

  for (const template of templates) {
    if (!bindingApplies(template.spec.binding, message.binding)) continue;
    if (isGatedKind(message.classified) && message.classified !== template.spec.overridesGate) continue;
    if (template.prefilter !== null && !lowered.includes(template.prefilter)) continue;
    const match = readMatch(template, message.text);
    if (match !== null) return match;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Checking a template before it is saved                                       */
/* -------------------------------------------------------------------------- */

/** Words so common in alerts that anchoring on them alone says little about the format. */
const GENERIC_ANCHORS = new Set([
  'inr', 'rs', 'debited', 'credited', 'debit', 'credit', 'paid', 'sent', 'received', 'spent', 'your',
  'account', 'acct', 'upi', 'ref', 'refno', 'txn', 'the', 'for', 'from', 'with', 'and', 'bank', 'card',
  'dear', 'customer', 'has', 'been', 'was', 'is', 'on', 'to', 'by', 'at', 'of', 'in', 'via',
]);

export type TemplateCheck = {
  /** Reasons it cannot be saved. */
  errors: string[];
  /** Reasons to look at the preview first. */
  warnings: string[];
};

export function checkTemplate(spec: TemplateSpec): TemplateCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields = new Set(
    spec.segments.flatMap((segment) => (segment.type === 'field' ? [segment.field] : [])),
  );

  if (!hasBinding(spec.binding)) {
    errors.push(
      "Finly can't tell which bank or app sent this, so it can't keep the format to them. Teach it from a message Finly caught itself, or one that names the bank.",
    );
  }
  if (spec.outcome !== 'ignore') {
    if (!fields.has('amount')) errors.push('Tap the amount in the message.');
    if (spec.direction === null) errors.push('Say whether the money went out or came in.');
  }
  if (compileTemplate(spec) === null) errors.push('This format could not be turned into a pattern.');

  const distinctive = spec.segments.some(
    (segment) =>
      segment.type === 'anchor' && /^[A-Za-z]{3,}$/.test(segment.text) && !GENERIC_ANCHORS.has(segment.text.toLowerCase()),
  );
  if (!distinctive && spec.outcome !== 'ignore') {
    warnings.push(
      'The words around what you tapped are common ones, so this may also read other messages from the same sender. Check the preview.',
    );
  }
  return { errors, warnings };
}

/**
 * The save gate: the compiled template must read its own example back exactly
 * as the user tagged it. Catches a derivation that dropped or misplaced a
 * field, before it can misread anything real.
 */
export function readsBack(
  spec: TemplateSpec,
  text: string,
  expected: { amountMinor: Minor | null; counterparty: string | null; reference: string | null; tail: string | null },
): boolean {
  const compiled = compileTemplate(spec);
  if (compiled === null) return false;
  const match = readMatch(compiled, text);
  if (match === null) return false;
  const same = (a: string | null, b: string | null) =>
    (a ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === (b ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    match.amountMinor === expected.amountMinor &&
    same(match.counterparty, expected.counterparty) &&
    same(match.reference, expected.reference) &&
    same(match.tail, expected.tail)
  );
}

/** What each tag covers in the example, as text — the values `readsBack` expects. */
export function taggedValues(
  text: string,
  tags: readonly Tag[],
): { amountMinor: Minor | null; counterparty: string | null; reference: string | null; tail: string | null } {
  const tokens = tokenise(text);
  const valueOf = (field: TemplateField): string | null => {
    const tag = tags.find((candidate) => candidate.field === field);
    if (tag === undefined || tag.start >= tag.end) return null;
    const from = tokens[tag.start];
    const to = tokens[tag.end - 1];
    if (from === undefined || to === undefined) return null;
    return text.slice(from.start, to.end);
  };
  const amount = valueOf('amount');
  return {
    amountMinor: amount === null ? null : parseMinor(amount.replace(/^[A-Za-z]{3}\s*/, '')),
    counterparty: valueOf('counterparty'),
    reference: valueOf('reference')?.toUpperCase() ?? null,
    tail: valueOf('tail'),
  };
}

/* -------------------------------------------------------------------------- */
/* Tapping                                                                      */
/* -------------------------------------------------------------------------- */

/** How far a second tap may reach along a line to grow a tag, in tokens. */
const MAX_REACH = 12;

/**
 * What one tap on token `index` does while tagging `field`:
 *
 * - on a tagged token: clears that tag, or trims it when the tap is on its
 *   first or last piece — so a name that took one word too many is fixed with
 *   one tap;
 * - near the field's own tag on the same line: grows the tag to reach it, so
 *   "arjun", ".", "k" becomes one payee with two taps, not three;
 * - anywhere else: moves the field's tag there.
 *
 * Tapping a currency mark for the amount tags the figure after it, since the
 * figure is what varies.
 */
export function tapToken(tokens: readonly Token[], tags: readonly Tag[], field: TemplateField, index: number): Tag[] {
  const token = tokens[index];
  if (token === undefined || token.kind === 'newline') return [...tags];

  let target = index;
  if (field === 'amount' && isCurrencyToken(token) && tokens[index + 1]?.kind === 'number') target = index + 1;

  const hit = tags.find((tag) => target >= tag.start && target < tag.end);
  if (hit !== undefined) {
    const others = tags.filter((tag) => tag !== hit);
    if (hit.end - hit.start > 1 && target === hit.start) return [...others, { ...hit, start: hit.start + 1 }];
    if (hit.end - hit.start > 1 && target === hit.end - 1) return [...others, { ...hit, end: hit.end - 1 }];
    return others;
  }

  const own = tags.find((tag) => tag.field === field);
  const withoutOwn = tags.filter((tag) => tag.field !== field);
  if (own !== undefined && field !== 'amount') {
    const from = Math.min(own.start, target);
    const to = Math.max(own.end, target + 1);
    const crossesLine = tokens.slice(from, to).some((piece) => piece.kind === 'newline');
    if (!crossesLine && to - from <= MAX_REACH) {
      /* Growing over another field's tag takes it over, so tags never overlap. */
      const rest = withoutOwn.filter((tag) => tag.end <= from || tag.start >= to);
      return [...rest, { field, start: from, end: to }];
    }
  }
  return [...withoutOwn.filter((tag) => !(target >= tag.start && target < tag.end)), { field, start: target, end: target + 1 }];
}

/* -------------------------------------------------------------------------- */
/* Pre-tagging from the generic reading                                         */
/* -------------------------------------------------------------------------- */

/** Token indices overlapping the character range [start, end). */
function tokensCovering(tokens: readonly Token[], start: number, end: number): { start: number; end: number } | null {
  let first = -1;
  let last = -1;
  tokens.forEach((token, index) => {
    if (token.end > start && token.start < end) {
      if (first === -1) first = index;
      last = index;
    }
  });
  return first === -1 ? null : { start: first, end: last + 1 };
}

/**
 * Tags for what the generic reader already found, so the user usually only
 * fixes the one thing it got wrong rather than tagging from scratch.
 */
export function suggestTags(
  text: string,
  reading: { amountMinor: Minor | null; counterparty: string | null; reference: string | null; instrumentTail: string | null },
): Tag[] {
  const tokens = tokenise(text);
  const tags: Tag[] = [];

  if (reading.amountMinor !== null) {
    const index = tokens.findIndex((token) => token.kind === 'number' && parseMinor(token.text) === reading.amountMinor);
    if (index !== -1) tags.push({ field: 'amount', start: index, end: index + 1 });
  }

  if (reading.counterparty !== null) {
    const at = text.toLowerCase().indexOf(reading.counterparty.toLowerCase());
    const span = at === -1 ? null : tokensCovering(tokens, at, at + reading.counterparty.length);
    if (span !== null) tags.push({ field: 'counterparty', ...span });
  }

  if (reading.reference !== null) {
    const index = tokens.findIndex((token) => token.text.toUpperCase() === reading.reference);
    if (index !== -1) tags.push({ field: 'reference', start: index, end: index + 1 });
  }

  if (reading.instrumentTail !== null) {
    const index = tokens.findIndex((token) => token.kind === 'number' && token.text === reading.instrumentTail);
    if (index !== -1 && !tags.some((tag) => index >= tag.start && index < tag.end)) {
      tags.push({ field: 'tail', start: index, end: index + 1 });
    }
  }

  return tags;
}

/** Which template read a detection, from its reasons, or null. */
export function templateIdOf(reasons: readonly string[]): string | null {
  for (const reason of reasons) {
    if (reason.startsWith('template:mute:')) return reason.slice('template:mute:'.length);
    if (reason.startsWith('template:')) return reason.slice('template:'.length);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Storage and contribution encoding                                            */
/* -------------------------------------------------------------------------- */

/**
 * Segments as short strings: `a:Sent`, `f:amount`, `#`, `w`, `g`, `G`, `n`,
 * with a leading `~` when glued. One encoding for the database column and the
 * email to the developer — compact enough that a template and a masked sample
 * fit comfortably in a mailto body.
 */
export function encodeSegments(segments: readonly Segment[]): string[] {
  return segments.map((segment) => {
    const glue = segment.glued ? '~' : '';
    switch (segment.type) {
      case 'anchor':
        return `${glue}a:${segment.text}`;
      case 'field':
        return `${glue}f:${segment.field}`;
      case 'number':
        return `${glue}#`;
      case 'word':
        return `${glue}w`;
      case 'gap':
        return `${glue}${segment.sameLine ? 'g' : 'G'}`;
      case 'newline':
        return `${glue}n`;
    }
  });
}

/** The reverse, rejecting anything malformed — a restored backup can carry anything. */
export function decodeSegments(encoded: unknown): Segment[] | null {
  if (!Array.isArray(encoded) || encoded.length === 0 || encoded.length > 200) return null;
  const segments: Segment[] = [];
  for (const entry of encoded) {
    if (typeof entry !== 'string') return null;
    const glued = entry.startsWith('~');
    const body = glued ? entry.slice(1) : entry;
    if (body === '#') segments.push({ type: 'number', glued });
    else if (body === 'w') segments.push({ type: 'word', glued });
    else if (body === 'g' || body === 'G') segments.push({ type: 'gap', sameLine: body === 'g', glued });
    else if (body === 'n') segments.push({ type: 'newline', glued });
    else if (body.startsWith('a:') && body.length > 2) segments.push({ type: 'anchor', text: body.slice(2), glued });
    else if (body.startsWith('f:') && (TEMPLATE_FIELDS as readonly string[]).includes(body.slice(2))) {
      segments.push({ type: 'field', field: body.slice(2) as TemplateField, glued });
    } else return null;
  }
  return segments;
}
