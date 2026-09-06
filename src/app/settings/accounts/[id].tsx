import { router, useLocalSearchParams } from 'expo-router';

import { AccountEditor, type AccountDraft } from '@/components/account-editor';
import { NotFound } from '@/components/not-found';
import { updateAccount } from '@/db/repositories/accounts';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { useAccount } from '@/features/accounts/hooks';
import { draftToInput, rowToDraft } from '@/features/accounts/mappers';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /* Hooks above returns — the lookup is a query now, so it flips between
     renders and a hook underneath would change the hook count. */
  const account = useAccount(id);
  const save = useAction(updateAccount);
  /* Above the early returns with the rest, so the account id is passed at press
     time rather than closed over before the query has answered. */
  const saveOnce = useSubmitOnce(async (rowId: string, draft: AccountDraft) => {
    const outcome = await save.run(rowId, draftToInput(draft));
    if (!outcome.ok) return false;
    router.back();
    return true;
  });

  if (account.error !== null) {
    return <NotFound title="Can't open this account" description={account.error.message} />;
  }

  const row = account.data;
  if (row === null) {
    return (
      <NotFound
        title="Account not found"
        description="It may have been deleted from another screen."
      />
    );
  }
  if (row === undefined) return null;

  return (
    <AccountEditor
      title="Edit account"
      submitLabel="Save changes"
      initial={rowToDraft(row)}
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={(draft) => void saveOnce.submit(row.id, draft)}
      onClose={() => router.back()}
    />
  );
}
