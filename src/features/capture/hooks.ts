/**
 * The review inbox (D17), live: what is waiting, the badge, one candidate, and
 * every decision the inbox can make.
 */

import type { Db } from '@/db/client';
import { useDbQuery, type TableName } from '@/db/live';
import {
  captureStats,
  clearCaptures,
  confirmCandidates,
  confirmCandidate,
  countCandidatesToReview,
  getCandidateDetail,
  linkCandidateToExpense,
  recordCandidateAsCardPayment,
  type CardPaymentDecision,
  listPendingCandidates,
  resolveCandidate,
  resolveCandidates,
  restoreCandidates,
  separateDuplicate,
  settleCandidate,
  undoConfirms,
  type CandidateDetail,
  type CandidateSummary,
  type ConfirmInput,
} from '@/db/repositories/captures';
import { forgetLabels, listLabelCounts } from '@/db/repositories/detector-labels';
import { getFlag, getSetting, setFlag, setSetting } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { listActiveRules } from '@/db/repositories/rules';
import { getActiveCurrency } from '@/domain/money';
import { sectionOf, splitForAdd, type InboxSection } from '@/domain/txn-detect';
import { shippedModel } from '@/domain/txn-detect/model/assess';
import { modelDoubts, type ModelContext } from '@/domain/txn-detect/model/doubt';
import type { Model } from '@/domain/txn-detect/model/weights-format';

import { ingestText, purgeExpired, retentionDays } from './ingest';
import { oneTapInput } from './presentation';

const INBOX_TABLES: readonly TableName[] = [
  'detected_transactions',
  'captured_messages',
  'categories',
  'accounts',
  /* The model's switch, and what the user has taught it per sender (D21). */
  'settings',
  'detector_labels',
];

/** How many pending candidates one screen shows. More waits for the next pass. */
const INBOX_LIMIT = 300;

export type InboxCandidate = CandidateSummary & { modelDoubt: boolean };

export type Inbox = Record<InboxSection, InboxCandidate[]>;

/** The shipped model, or none if it cannot be read: the rules alone still sort the inbox. */
function loadModel(): Model | null {
  try {
    return shippedModel();
  } catch {
    return null;
  }
}

const readModelContext = (database: Db): ModelContext => ({
  enabled: getFlag('capture_detector_enabled', database),
  counts: listLabelCounts(database),
  model: loadModel(),
});

/**
 * A candidate with the model's doubt applied (D21): doubted by the rules or by
 * the model, and `modelDoubt` saying which, for the review screen's sentence.
 */
function withModel<T extends CandidateSummary>(candidate: T, context: ModelContext): T & { modelDoubt: boolean } {
  const modelDoubt = !candidate.doubt && modelDoubts(candidate, context);
  return { ...candidate, doubt: candidate.doubt || modelDoubt, modelDoubt };
}

const readInbox = (database: Db): Inbox => {
  const inbox: Inbox = { review: [], maybe: [], money_in: [], filtered: [] };
  const context = readModelContext(database);
  for (const candidate of listPendingCandidates(INBOX_LIMIT, database)) {
    const read = withModel(candidate, context);
    inbox[sectionOf(read)].push(read);
  }
  return inbox;
};

export function useInbox() {
  return useDbQuery<Inbox>('capture:inbox', INBOX_TABLES, readInbox);
}

/** Whether detection is switched on — cheap, for the header button. */
export function useCaptureEnabled() {
  return useDbQuery<boolean>('capture:enabled', ['settings'], (database) =>
    getFlag('capture_enabled', database),
  );
}

/** The badge on Balance: pending candidates that might be spending. */
export function useReviewCount() {
  return useDbQuery<number>('capture:count', ['detected_transactions'], (database) =>
    countCandidatesToReview(database),
  );
}

export function useCandidate(id: string) {
  return useDbQuery<(CandidateDetail & { modelDoubt: boolean }) | null>(
    `capture:candidate:${id}`,
    [...INBOX_TABLES, 'expenses', 'settlements'],
    (database) => {
      const detail = getCandidateDetail(id, database);
      return detail === null ? null : withModel(detail, readModelContext(database));
    },
  );
}

export function useConfirmCandidate() {
  return useAction((id: string, input: ConfirmInput) => confirmCandidate(id, input));
}

export function useLinkCandidate() {
  return useAction((id: string, expenseId: string) => linkCandidateToExpense(id, expenseId));
}

export function useSettleCandidate() {
  return useAction((id: string, expenseId: string) => settleCandidate(id, expenseId));
}

export function useRecordCardPayment() {
  return useAction((id: string, decision: CardPaymentDecision) =>
    recordCandidateAsCardPayment(id, decision),
  );
}

export function useResolveCandidate() {
  return useAction((id: string, status: 'dismissed' | 'not_transaction') => resolveCandidate(id, status));
}

export function useSeparateDuplicate() {
  return useAction((id: string) => separateDuplicate(id));
}

/**
 * Confirm as read, from a row: the suggested category and account, with the
 * user's rules applied exactly as the entry form would apply them.
 */
export function useConfirmAsRead() {
  return useAction((candidate: CandidateSummary) =>
    confirmCandidate(candidate.id, oneTapInput(candidate, listActiveRules())),
  );
}

/**
 * Adds a batch as read, all or nothing: only what one tap could confirm — a
 * sure amount in the app's currency, from Needs review. Anything less sure is
 * left where it is for a look (D17). Returns the ids it added, for the undo.
 */
export function useAddCandidates() {
  return useAction((candidates: readonly CandidateSummary[]) => {
    const rules = listActiveRules();
    const { addable } = splitForAdd(candidates, getActiveCurrency().code);
    confirmCandidates(addable.map((candidate) => ({ id: candidate.id, input: oneTapInput(candidate, rules) })));
    return addable.map((candidate) => candidate.id);
  });
}

export function useDismissCandidates() {
  return useAction((ids: readonly string[]) => resolveCandidates(ids, 'dismissed'));
}

export function useRestoreCandidates() {
  return useAction((ids: readonly string[]) => restoreCandidates(ids));
}

export function useUndoConfirms() {
  return useAction((ids: readonly string[]) => undoConfirms(ids));
}

export function usePasteMessage() {
  return useAction((text: string) => ingestText(text, 'paste'));
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                     */
/* -------------------------------------------------------------------------- */

export type CaptureSettings = {
  enabled: boolean;
  disclosureAcceptedAt: number | null;
  /** Payment apps the user chose, beyond the SMS app, which is always read. */
  packages: string[];
  notify: boolean;
  retentionDays: number;
  stats: { messages: number; pending: number };
  /** D21: the model may move doubtful payments to Maybe. Off, it only scores them. */
  detectorEnabled: boolean;
  /** Senders the user's own choices have taught it something about. */
  learnedSenders: number;
  /** Whether the shipped model has a threshold at all; without one it moves nothing yet. */
  modelCanDoubt: boolean;
};

export function parsePackages(json: string | null): string[] {
  if (json === null) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

const readSettings = (database: Db): CaptureSettings => {
  const accepted = Number(getSetting('capture_disclosure_accepted_at', database));
  return {
    enabled: getFlag('capture_enabled', database),
    disclosureAcceptedAt: Number.isFinite(accepted) && accepted > 0 ? accepted : null,
    packages: parsePackages(getSetting('capture_packages', database)),
    notify: getFlag('capture_notify_enabled', database),
    retentionDays: retentionDays(database),
    stats: captureStats(database),
    detectorEnabled: getFlag('capture_detector_enabled', database),
    learnedSenders: [...listLabelCounts(database).values()].filter(
      (counts) => counts.confirmed + counts.notTransaction > 0,
    ).length,
    modelCanDoubt: loadModel()?.threshold.doubt != null,
  };
};

export function useCaptureSettings() {
  return useDbQuery<CaptureSettings>(
    'capture:settings',
    ['settings', 'captured_messages', 'detected_transactions', 'detector_labels'],
    readSettings,
  );
}

export function useSetCaptureEnabled() {
  return useAction((enabled: boolean) => setFlag('capture_enabled', enabled));
}

export function useAcceptDisclosure() {
  return useAction(() => setSetting('capture_disclosure_accepted_at', String(Date.now())));
}

export function useSetCapturePackages() {
  return useAction((packages: readonly string[]) =>
    setSetting('capture_packages', JSON.stringify([...new Set(packages)])),
  );
}

export function useSetCaptureNotify() {
  return useAction((notify: boolean) => setFlag('capture_notify_enabled', notify));
}

export function useSetRetentionDays() {
  return useAction((days: number) => {
    setSetting('capture_retention_days', String(days));
    purgeExpired();
  });
}

export function useSetDetectorEnabled() {
  return useAction((enabled: boolean) => setFlag('capture_detector_enabled', enabled));
}

/** "Forget what Finly learned from your choices" (D21). Taught formats stay. */
export function useForgetLabels() {
  return useAction(() => forgetLabels());
}

export function useClearCaptures() {
  return useAction(() => clearCaptures());
}
