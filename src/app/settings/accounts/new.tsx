import { router } from 'expo-router';

import { AccountEditor, type AccountDraft } from '@/components/account-editor';
import { createAccount } from '@/db/repositories/accounts';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { draftToInput } from '@/features/accounts/mappers';

export default function NewAccountScreen() {
  /* One press, one row. The write is synchronous, so by the time a second
     press lands the first has long finished and would simply create another. */
  const save = useAction(createAccount);
  const saveOnce = useSubmitOnce(async (draft: AccountDraft) => {
    const outcome = await save.run(draftToInput(draft));
    if (!outcome.ok) return false;
    router.back();
    return true;
  });

  return (
    <AccountEditor
      title="New account"
      submitLabel="Add account"
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={(draft) => void saveOnce.submit(draft)}
      onClose={() => router.back()}
    />
  );
}
