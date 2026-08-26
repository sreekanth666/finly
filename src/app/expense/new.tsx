import { router } from 'expo-router';

import { ExpenseForm } from '@/components/expense-form';

export default function NewExpenseScreen() {
  return (
    <ExpenseForm
      title="New expense"
      submitLabel="Save"
      onSubmit={() => router.back()}
      /* The form clears itself; nothing is persisted in the design pass. */
      onSubmitAndContinue={() => {}}
      onClose={() => router.back()}
    />
  );
}
