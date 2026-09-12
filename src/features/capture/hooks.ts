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
  listPendingCandidates,
  resolveCandidate,
  restoreCandidate,
  separateDuplicate,
  settleCandidate,
  undoConfirm,
  type CandidateDetail,
  type CandidateSummary,
  type ConfirmInput,
} from '@/db/repositories/captures';
import { getFlag, getSetting, setFlag, setSetting } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { listActiveRules } from '@/db/repositories/rules';
import { getActiveCurrency } from '@/domain/money';
import { canConfirmInOneTap, sectionOf, type InboxSection } from '@/domain/txn-detect';

import { ingestText, purgeExpired, retentionDays } from './ingest';
import { oneTapInput } from './presentation';

const INBOX_TABLES: readonly TableName[] = [
  'detected_transactions',
  'captured_messages',
  'categories',
  'accounts',
];

/** How many pending candidates one screen shows. More waits for the next pass. */
const INBOX_LIMIT = 300;

export type Inbox = Record<InboxSection, CandidateSummary[]>;

const readInbox = (database: Db): Inbox => {
  const inbox: Inbox = { review: [], maybe: [], money_in: [], filtered: [] };
  for (const candidate of listPendingCandidates(INBOX_LIMIT, database)) {
    inbox[sectionOf(candidate)].push(candidate);
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
  return useDbQuery<CandidateDetail | null>(
    `capture:candidate:${id}`,
    [...INBOX_TABLES, 'expenses', 'settlements'],
    (database) => getCandidateDetail(id, database),
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

export function useResolveCandidate() {
  return useAction((id: string, status: 'dismissed' | 'not_transaction') => resolveCandidate(id, status));
}

export function useRestoreCandidate() {
  return useAction((id: string) => restoreCandidate(id));
}

export function useUndoConfirm() {
  return useAction((id: string) => undoConfirm(id));
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
 * Confirms every candidate in Needs review that can be confirmed as read — a
 * sure rupee amount and a named payee. Anything less sure stays for a look.
 */
export function useConfirmAllCertain() {
  return useAction((candidates: readonly CandidateSummary[]) => {
    const rules = listActiveRules();
    return confirmCandidates(
      candidates
        .filter((candidate) => canConfirmInOneTap(candidate, getActiveCurrency().code))
        .map((candidate) => ({ id: candidate.id, input: oneTapInput(candidate, rules) })),
    );
  });
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
  };
};

export function useCaptureSettings() {
  return useDbQuery<CaptureSettings>(
    'capture:settings',
    ['settings', 'captured_messages', 'detected_transactions'],
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

export function useClearCaptures() {
  return useAction(() => clearCaptures());
}
