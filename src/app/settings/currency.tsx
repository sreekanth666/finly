import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyPicker } from '@/components/currency-picker';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { useDbQuery } from '@/db/live';
import { getCurrency, setCurrency } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { setActiveCurrency, type Currency } from '@/domain/money';

export default function CurrencySettingsScreen() {
  const current = useDbQuery('settings:currency', ['settings'], (database) =>
    getCurrency(database),
  );

  const save = useAction((currency: Currency) => {
    setCurrency(currency);
    setActiveCurrency(currency);
  });

  const choose = (currency: Currency) => {
    if (currency.code === current.data?.code) return;

    Alert.alert(
      `Show amounts in ${currency.name}?`,
      /*
       * This has to be said plainly. Nothing is converted — the stored integer
       * is untouched, so ₹5,000 becomes $5,000, not its exchange value. Anyone
       * expecting conversion would otherwise read every figure wrongly.
       */
      'Amounts are not converted. A ₹5,000 budget becomes 5,000 in the new currency, not its exchange value. Only how figures are written changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            await save.run(currency);
            current.refetch();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Currency
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <SectionHeader label="Show amounts in" />

        {current.data !== undefined && (
          <CurrencyPicker selected={current.data.code} onSelect={choose} />
        )}

        <View className="flex-row items-start gap-3 rounded-3xl bg-surface p-4">
          <Icon icon={TriangleAlert} color="warning" size={16} />
          <Typography type="body-xs" color="muted" className="flex-1">
            Changing this converts nothing. Every amount you have recorded stays the number it
            already was — only the symbol and the way digits are grouped change.
          </Typography>
        </View>

        {save.errorMessage !== null && (
          <Typography type="body-xs" className="px-1 text-danger">
            {save.errorMessage}
          </Typography>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
