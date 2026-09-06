import { router } from 'expo-router';

import { ExpenseForm, type ExpenseDraft } from '@/components/expense-form';
import { NotFound } from '@/components/not-found';
import { recordRuleApplied } from '@/db/repositories/rules';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { createExpense } from '@/db/repositories/expenses';
import { useAccounts, useCategoriesByUse } from '@/features/catalog/hooks';
import { useActiveRules } from '@/features/rules/hooks';
import { useEntryDefaults } from '@/features/expenses/hooks';

export default function NewExpenseScreen() {
  const categories = useCategoriesByUse();
  const accounts = useAccounts();
  const defaults = useEntryDefaults();
  const rules = useActiveRules();
  const save = useAction(createExpense);
  /* Save ends this screen, so it may only happen once. Save & add another
     deliberately stays open below — it clears the form for the next expense
     rather than leaving, and the cleared form disables its own button. */
  const saveOnce = useSubmitOnce(async (draft: ExpenseDraft, appliedRuleId: string | null) => {
    const outcome = await save.run(draft);
    if (!outcome.ok) return false;
    if (appliedRuleId !== null) recordRuleApplied(appliedRuleId);
    router.back();
    return true;
  });

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
      onSubmit={(draft, appliedRuleId) => void saveOnce.submit(draft, appliedRuleId)}
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
