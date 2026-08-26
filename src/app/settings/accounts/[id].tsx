import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountEditor, type AccountDraft } from '@/components/account-editor';
import { Button } from '@/components/button';
import { findAccount, type Account, type AccountColorToken } from '@/data/accounts';

const toDraft = (account: Account): AccountDraft => ({
  name: account.name,
  type: account.type,
  issuer: account.issuer ?? '',
  last4: account.last4 ?? '',
  creditLimit: account.creditLimit === undefined ? '' : String(account.creditLimit),
  statementDay: account.statementDay === undefined ? '' : String(account.statementDay),
  colorToken: account.colorToken as AccountColorToken,
});

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = findAccount(id);

  if (!account) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Typography type="body" weight="medium">
            Account not found
          </Typography>
          <Typography type="body-sm" color="muted" align="center">
            It may have been removed since this screen was opened.
          </Typography>
          <Button tone="secondary" label="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AccountEditor
      title="Edit account"
      initial={toDraft(account)}
      submitLabel="Save changes"
      onSubmit={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
