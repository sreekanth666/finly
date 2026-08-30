import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { RuleCard } from '@/components/rule-card';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { setRuleEnabled } from '@/db/repositories/rules';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useRules } from '@/features/rules/hooks';

export default function RulesScreen() {
  const rules = useRules();
  const categories = useCategories(true);
  const accounts = useAccounts(true);
  const ruleList = rules.data ?? [];

  /* The design pass toggled local state, so a rule switched off came back on
     the moment you navigated away. This writes. */
  const toggleRule = useCallback((id: string, isEnabled: boolean) => {
    setRuleEnabled(id, isEnabled);
  }, []);

  /**
   * Priority is the whole point of the list, so the order on screen *is* the
   * evaluation order. Paused rules are held back rather than dropped — they
   * still exist, they just aren't consulted.
   */
  const sections = useMemo(() => {
    const byPriority = [...ruleList].sort((a, b) => b.priority - a.priority);

    return [
      { id: 'active', label: 'Active', rules: byPriority.filter((rule) => rule.isEnabled) },
      { id: 'paused', label: 'Paused', rules: byPriority.filter((rule) => !rule.isEnabled) },
    ].filter((section) => section.rules.length > 0);
  }, [ruleList]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="gap-5 pt-2 pb-4">
        <View className="px-5">
          <ScreenHeader />
        </View>

        <View className="gap-1 px-5">
          <View className="flex-row items-center justify-between gap-3">
            <Typography.Heading type="h2" weight="bold" className="flex-1" truncate>
              Rules
            </Typography.Heading>
            <Button
              icon={Plus}
              label="New"
              size="sm"
              accessibilityLabel="New rule"
              onPress={() => router.push('/rule/new')}
            />
          </View>
          <Typography type="body-sm" color="muted">
            Checked top to bottom — the first match wins.
          </Typography>
        </View>
      </View>

      <FlatList
        className="flex-1"
        data={sections}
        keyExtractor={(section) => section.id}
        renderItem={({ item: section }) => (
          <View className="gap-3">
            <SectionHeader
              label={section.label}
              trailing={
                <Typography type="body-sm" color="muted">
                  {section.rules.length === 1 ? '1 rule' : `${section.rules.length} rules`}
                </Typography>
              }
            />

            <View className="gap-3">
              {section.rules.map((rule, index) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  categories={categories.data ?? []}
                  accounts={accounts.data ?? []}
                  rank={section.id === 'active' ? index + 1 : null}
                  onToggle={(isEnabled) => toggleRule(rule.id, isEnabled)}
                  onPress={() => router.push(`/rule/${rule.id}`)}
                />
              ))}
            </View>
          </View>
        )}
        contentContainerClassName="gap-6 px-5 pb-8"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          rules.error !== null ? (
            <ErrorState error={rules.error} onRetry={rules.refetch} />
          ) : (
            <EmptyState
              icon={Plus}
              title="No rules yet"
              description="A rule fills in the category and account as you type, so a repeat expense takes four taps."
              action={{ label: 'Create a rule', icon: Plus, onPress: () => router.push('/rule/new') }}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
