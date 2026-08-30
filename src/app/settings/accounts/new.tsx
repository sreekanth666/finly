import { router } from 'expo-router';

import { AccountEditor } from '@/components/account-editor';
import { createAccount } from '@/db/repositories/accounts';
import { useAction } from '@/db/use-action';
import { draftToInput } from '@/features/accounts/mappers';

export default function NewAccountScreen() {
  const save = useAction(createAccount);

  return (
    <AccountEditor
      title="New account"
      submitLabel="Add account"
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={async (draft) => {
        const outcome = await save.run(draftToInput(draft));
        if (outcome.ok) router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
