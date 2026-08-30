import { router } from 'expo-router';

import { ExpenseForm } from '@/components/expense-form';
import { NotFound } from '@/components/not-found';
import { recordRuleApplied } from '@/db/repositories/rules';
import { useAction } from '@/db/use-action';
import { createExpense } from '@/db/repositories/expenses';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useActiveRules } from '@/features/rules/hooks';
import { useEntryDefaults } from '@/features/expenses/hooks';

export default function NewExpenseScreen() {
  const categories = useCategories();
  const accounts = useAccounts();
  const defaults = useEntryDefaults();
  const rules = useActiveRules();
  const save = useAction(createExpense);

  const failure = categories.error ?? accounts.error ?? defaults.error;
  if (failure !== null && failure !== undefined) {
    return <NotFound title="Can't add an expense" description={failure.message} />;
  }

  return (
    <ExpenseForm
      title="New expense"
      submitLabel="Save"
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      recentItems={defaults.data?.recentItems ?? []}
      rules={rules.data ?? []}
      onRuleApplied={(ruleId) => recordRuleApplied(ruleId)}
      initial={{ accountId: defaults.data?.accountId ?? null }}
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={async (draft, appliedRuleId) => {
        const outcome = await save.run(draft);
        if (!outcome.ok) return;
        if (appliedRuleId !== null) recordRuleApplied(appliedRuleId);
        router.back();
      }}
      /* Save & add another stays on the form — the whole point is the next
         expense, so navigating away would undo the saving it does (§7.2). */
      onSubmitAndContinue={async (draft) => {
        const outcome = await save.run(draft);
        return outcome.ok;
      }}
      onClose={() => router.back()}
    />
  );
}
