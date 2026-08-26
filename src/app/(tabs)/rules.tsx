import { Typography } from 'heroui-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RuleCard } from '@/components/rule-card';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { rules as seedRules } from '@/data/rules';

export default function RulesScreen() {
  const [ruleList, setRuleList] = useState(seedRules);

  const toggleRule = useCallback((id: string, isEnabled: boolean) => {
    setRuleList((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, isEnabled } : rule))
    );
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
          <Typography.Heading type="h2" weight="bold">
            Rules
          </Typography.Heading>
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
                  rank={section.id === 'active' ? index + 1 : null}
                  onToggle={(isEnabled) => toggleRule(rule.id, isEnabled)}
                />
              ))}
            </View>
          </View>
        )}
        contentContainerClassName="gap-6 px-5 pb-8"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center gap-1 py-16">
            <Typography type="body" weight="medium">
              No rules yet
            </Typography>
            <Typography type="body-sm" color="muted">
              Rules fill in a category and account as you type.
            </Typography>
          </View>
        }
      />
    </SafeAreaView>
  );
}
