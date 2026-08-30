import { router, useLocalSearchParams } from 'expo-router';

import { ExpenseForm } from '@/components/expense-form';
import { NotFound } from '@/components/not-found';
import { updateExpense } from '@/db/repositories/expenses';
import { recordRuleApplied } from '@/db/repositories/rules';
import { useAction } from '@/db/use-action';
import { minorToEntry } from '@/domain/money';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useActiveRules } from '@/features/rules/hooks';
import { useExpenseDetail } from '@/features/expenses/hooks';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /*
   * Every hook is above every return. The design pass could get away with an
   * early return before its useState because the lookup was a synchronous
   * fixture read that could never change; a query flips from undefined to a row
   * between renders, and a hook underneath would change the hook count.
   */
  const detail = useExpenseDetail(id);
  const categories = useCategories();
  const accounts = useAccounts();
  const rules = useActiveRules();
  const save = useAction(updateExpense);

  const failure = detail.error ?? categories.error ?? accounts.error;
  if (failure !== null && failure !== undefined) {
    return <NotFound title="Can't edit this expense" description={failure.message} />;
  }

  const view = detail.data;
  if (view === null) {
    return (
      <NotFound
        title="Expense not found"
        description="It may have been deleted from another screen."
      />
    );
  }
  if (view === undefined) return null;

  const { expense } = view;

  return (
    <ExpenseForm
      title="Edit expense"
      submitLabel="Save changes"
      isPrefilled
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      rules={rules.data ?? []}
      initial={{
        entry: minorToEntry(expense.amountMinor),
        item: expense.item,
        note: expense.note ?? '',
        categoryId: expense.category?.id ?? null,
        accountId: expense.account?.id ?? null,
        countsToBudget: expense.countsToBudget,
        occurredAt: expense.occurredAt,
      }}
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={async (draft) => {
        const outcome = await save.run(expense.id, draft);
        if (outcome.ok) router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
