import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { Archive, ArrowLeft, Plus, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ReorderButtons } from '@/components/reorder-buttons';
import { SectionHeader } from '@/components/section-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { reorderAccounts, setAccountArchived } from '@/db/repositories/accounts';
import type { AccountRow } from '@/db/schema';
import { isAtEdge, moveItem } from '@/domain/reorder';
import { useAccounts } from '@/features/catalog/hooks';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from '@/features/accounts/presentation';
import { toAppColor } from '@/theme';

const ROW = {
  first: 'flex-row items-center gap-3 px-3 py-2.5',
  rest: 'flex-row items-center gap-3 border-t border-border px-3 py-2.5',
} as const;

const describe = (account: AccountRow) =>
  [ACCOUNT_TYPE_LABELS[account.type], account.last4 && `••${account.last4}`]
    .filter(Boolean)
    .join(' · ');

export default function AccountsSettingsScreen() {
  const accounts = useAccounts(true);
  const list = accounts.data ?? [];

  /* Order is kept on the whole list; the sections are just a view of it. */
  const active = useMemo(() => list.filter((account) => !account.isArchived), [list]);
  const archived = useMemo(() => list.filter((account) => account.isArchived), [list]);

  /*
   * moveItem reorders the array; sort_order has to be written back or the order
   * silently resets on the next read and the buttons look broken. The design
   * pass only ever did the first half.
   */
  const move = (account: AccountRow, direction: -1 | 1) => {
    const index = active.findIndex((candidate) => candidate.id === account.id);
    const reordered = moveItem(active, index, direction);
    reorderAccounts([...reordered, ...archived].map((row) => row.id));
    accounts.refetch();
  };

  const setArchived = (id: string, isArchived: boolean) => {
    setAccountArchived(id, isArchived);
    accounts.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold" className="flex-1">
          Accounts
        </Typography>
        <Button
          tone="secondary"
          size="sm"
          icon={Plus}
          label="New"
          accessibilityLabel="New account"
          onPress={() => router.push('/settings/accounts/new')}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <SectionHeader
            label="Active"
            trailing={
              <Typography type="body-sm" color="muted">
                Order used across the app
              </Typography>
            }
          />

          {accounts.error !== null ? (
            <ErrorState error={accounts.error} onRetry={accounts.refetch} />
          ) : active.length === 0 ? (
            /* §5 seeds no accounts on purpose — the user's own cards are the
               point, and a placeholder would sit in every utilisation figure
               until they noticed. So this empty state is the first-run state. */
            <EmptyState
              icon={Plus}
              title="No accounts yet"
              description="Add the cards and accounts you pay from, and Finly can show what each one is carrying."
              action={{
                label: 'Add an account',
                icon: Plus,
                onPress: () => router.push('/settings/accounts/new'),
              }}
            />
          ) : (
            <View className="rounded-3xl bg-surface">
              {active.map((account, index) => (
              <View key={account.id} className={index === 0 ? ROW.first : ROW.rest}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/settings/accounts/${account.id}`)}
                  className="flex-1 flex-row items-center gap-3 active:opacity-60">
                  <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                    <Icon
                      icon={ACCOUNT_TYPE_ICONS[account.type]}
                      color={toAppColor(account.colorToken)}
                      size={16}
                    />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Typography type="body-sm" weight="medium" truncate>
                      {account.name}
                    </Typography>
                    <Typography type="body-xs" color="muted" truncate>
                      {describe(account)}
                    </Typography>
                  </View>
                </Pressable>

                <ReorderButtons
                  label={account.name}
                  canMoveUp={!isAtEdge(active, index, -1)}
                  canMoveDown={!isAtEdge(active, index, 1)}
                  onMoveUp={() => move(account, -1)}
                  onMoveDown={() => move(account, 1)}
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${account.name}`}
                  onPress={() => setArchived(account.id, true)}
                  className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
                  <Icon icon={Archive} color="muted" size={15} />
                </Pressable>
              </View>
            ))}
            </View>
          )}

          <Typography type="body-xs" color="muted" className="px-1">
            Archiving hides an account from new expenses. Nothing that already points at it
            changes, which is why there is no delete.
          </Typography>
        </View>

        {archived.length > 0 && (
          <View className="gap-3">
            <SectionHeader
              label="Archived"
              trailing={
                <Typography type="body-sm" color="muted">
                  {`${archived.length} hidden`}
                </Typography>
              }
            />

            <View className="rounded-3xl bg-surface">
              {archived.map((account, index) => (
                <View key={account.id} className={index === 0 ? ROW.first : ROW.rest}>
                  <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                    <Icon icon={ACCOUNT_TYPE_ICONS[account.type]} color="muted" size={16} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Typography type="body-sm" color="muted" truncate>
                      {account.name}
                    </Typography>
                    <Typography type="body-xs" color="muted" truncate>
                      {describe(account)}
                    </Typography>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${account.name}`}
                    onPress={() => setArchived(account.id, false)}
                    className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
                    <Icon icon={RotateCcw} color="muted" size={15} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
