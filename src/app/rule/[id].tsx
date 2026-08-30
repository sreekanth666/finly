import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { RuleEditor, type RuleDraft } from '@/components/rule-editor';
import { rules } from '@/data/rules';

import type { Rule } from '@/data/rules';

const toDraft = (rule: Rule): Partial<RuleDraft> => ({
  name: rule.name,
  isEnabled: rule.isEnabled,
  priority: String(rule.priority),
  matchMode: rule.matchMode,
  conditions: rule.conditions,
  categoryId:
    rule.actions.find((action) => action.type === 'set_category')?.categoryId ?? null,
  accountName: rule.actions.find((action) => action.type === 'set_account')?.label ?? null,
  countsToBudget:
    rule.actions.find((action) => action.type === 'set_counts_to_budget')?.countsToBudget ?? null,
});

export default function EditRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rule = rules.find((candidate) => candidate.id === id);

  if (!rule) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Typography type="body" weight="medium">
            Rule not found
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
    <RuleEditor
      title="Edit rule"
      initial={toDraft(rule)}
      submitLabel="Save changes"
      onSubmit={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
