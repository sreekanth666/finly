import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CandidateReview } from '@/components/candidate-review';
import { CardPaymentReview } from '@/components/card-payment-review';
import { MoneyInReview } from '@/components/money-in-review';
import { NotFound } from '@/components/not-found';
import { useActiveRules } from '@/features/rules/hooks';
import { useAccounts, useCategoriesByUse } from '@/features/catalog/hooks';
import { useCandidate } from '@/features/capture/hooks';
import { useRecentExpenses } from '@/features/expenses/hooks';

/** How far back money in may be settled against, in expenses. */
const SETTLE_WINDOW = 40;

/**
 * One detected transaction. Every hook sits above every return — the candidate
 * is a query that flips from undefined to a row, and a hook under an early
 * return would change the hook count between those renders.
 */
export default function CandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useCandidate(id);
  const categories = useCategoriesByUse();
  const accounts = useAccounts();
  const rules = useActiveRules();
  const recent = useRecentExpenses(SETTLE_WINDOW);
  /* A card bill opens as a payment toward the card (D20); this is the way back
     to the ordinary form, for one that really was spending. */
  const [isExpense, setIsExpense] = useState(false);

  const failure = detail.error ?? categories.error ?? accounts.error ?? rules.error;
  if (failure !== null && failure !== undefined) {
    return <NotFound title="Can't open this" description={failure.message} />;
  }

  const candidate = detail.data;
  if (candidate === null) {
    return <NotFound title="Already cleared" description="Its message has been removed from the inbox." />;
  }
  if (candidate === undefined) return null;

  if (candidate.status !== 'pending') {
    return (
      <NotFound
        title="Already dealt with"
        description={
          candidate.status === 'confirmed'
            ? candidate.cardPaymentId !== null
              ? 'This was recorded as a card payment.'
              : 'This was added as an expense.'
            : candidate.status === 'settled'
              ? 'This was recorded as money back.'
              : 'This was dismissed.'
        }
      />
    );
  }

  if (candidate.reasons.includes('transfer:card-bill') && !isExpense) {
    return (
      <CardPaymentReview
        candidate={candidate}
        accounts={accounts.data ?? []}
        onAddAsExpense={() => setIsExpense(true)}
      />
    );
  }

  if (candidate.direction === 'credit') {
    return <MoneyInReview candidate={candidate} expenses={recent.data ?? []} />;
  }

  return (
    <CandidateReview
      candidate={candidate}
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      rules={rules.data ?? []}
    />
  );
}
