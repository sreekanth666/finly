import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ExpenseForm, type DateChoice, type ExpenseDraft } from '@/components/expense-form';
import { findAccountByName } from '@/data/accounts';
import { findTransaction, type TransactionLookup } from '@/data/transactions';
import { minorToEntry } from '@/domain/money';

/** The feed's day groups are labelled, not dated, until real dates land in M1. */
const toDateChoice = (dayId: string): DateChoice =>
  dayId === 'today' || dayId === 'yesterday' ? dayId : 'earlier';

const toDraft = ({ transaction, day }: TransactionLookup): Partial<ExpenseDraft> => ({
  entry: minorToEntry(transaction.amountMinor),
  item: transaction.title,
  note: transaction.note ?? '',
  categoryId: transaction.categoryId,
  accountId: findAccountByName(transaction.accountName)?.id ?? null,
  countsToBudget: transaction.countsToBudget ?? true,
  date: toDateChoice(day.id),
});

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = findTransaction(id);

  if (!found) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Typography type="body" weight="medium">
            Expense not found
          </Typography>
          <Typography type="body-sm" color="muted" align="center">
            It may have been deleted since this screen was opened.
          </Typography>
          <Button tone="secondary" label="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ExpenseForm
      title="Edit expense"
      initial={toDraft(found)}
      /* Every field arrives answered, so a matching rule can't quietly rewrite
         what this expense was saved with. */
      isPrefilled
      submitLabel="Save changes"
      onSubmit={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
