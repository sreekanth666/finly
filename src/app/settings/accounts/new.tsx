import { router } from 'expo-router';

import { AccountEditor } from '@/components/account-editor';

export default function NewAccountScreen() {
  return (
    <AccountEditor
      title="New account"
      submitLabel="Add account"
      onSubmit={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
