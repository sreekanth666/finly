import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import {
  ArrowDownUp,
  ArrowLeft,
  CircleDollarSign,
  Info,
  Shapes,
  Coins,
  ShieldCheck,
  Wallet,
} from 'lucide-react-native';
import { Alert, ScrollView, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { useDbQuery } from '@/db/live';
import { getCurrency } from '@/db/repositories/settings';
import { runDevSeed } from '@/db/dev-seed';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useDefaultMonthlyBudget } from '@/features/budget/hooks';
import { formatMinor } from '@/domain/money';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export default function SettingsScreen() {
  const budget = useDefaultMonthlyBudget();
  const currency = useDbQuery('settings:currency-code', ['settings'], (database) =>
    getCurrency(database),
  );
  const accountRows = useAccounts();
  const categoryRows = useCategories();

  /* A count of 0 and a failed read are different things, and '0 accounts' is
     the more damaging of the two to show when it isn't true. */
  const activeAccounts = accountRows.data === undefined ? null : accountRows.data.length;
  const categoryCount = categoryRows.data === undefined ? null : categoryRows.data.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Settings
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <SectionHeader label="Money" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={CircleDollarSign}
              iconTone="accent"
              label="Monthly budget"
              description="One overall cap, carried over when overspent"
              value={budget.data === undefined ? '—' : formatMinor(budget.data, { showFraction: false })}
              onPress={() => router.push('/settings/budget')}
            />
            <SettingsRow
              isFirst={false}
              icon={Coins}
              iconTone="iris"
              label="Currency"
              value={currency.data?.code ?? '—'}
              onPress={() => router.push('/settings/currency')}
            />
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Setup" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={Wallet}
              iconTone="iris"
              label="Accounts"
              description="Cards, banks, cash and wallets"
              value={activeAccounts === null ? '—' : plural(activeAccounts, 'account', 'accounts')}
              onPress={() => router.push('/settings/accounts')}
            />
            <SettingsRow
              isFirst={false}
              icon={Shapes}
              iconTone="income"
              label="Categories"
              description="Rename, reorder and archive"
              value={categoryCount === null ? '—' : plural(categoryCount, 'category', 'categories')}
              onPress={() => router.push('/settings/categories')}
            />
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Security" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={ShieldCheck}
              iconTone="accent"
              label="App lock & encryption"
              description="Both off by default"
              onPress={() => router.push('/settings/security')}
            />
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Data" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={ArrowDownUp}
              iconTone="foreground"
              label="Import & export"
              description="CSV in, JSON or CSV out — this device is the only copy"
              onPress={() => router.push('/settings/data')}
            />
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="About" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={Info}
              iconTone="muted"
              label="Finly"
              value={Constants.expoConfig?.version ?? '—'}
              /* Long-press seeds three months of history. __DEV__ only, and
                 hidden, so it can never reach real data by accident. */
              onLongPress={
                __DEV__
                  ? () => {
                      try {
                        const seeded = runDevSeed();
                        Alert.alert(
                          'Development data added',
                          `${seeded.expenses} expenses, ${seeded.accounts} accounts, ${seeded.settlements} settlement, ${seeded.rules} rule.`,
                        );
                      } catch (cause) {
                        Alert.alert('Could not seed', cause instanceof Error ? cause.message : String(cause));
                      }
                    }
                  : undefined
              }
            />
          </View>
          <Typography type="body-xs" color="muted" className="px-1">
            Local-first: there is no account and no server. Your data never leaves the device, so
            an export is the only backup.
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
