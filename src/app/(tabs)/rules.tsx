import { Typography } from 'heroui-native';
import { CircleQuestionMark, LayoutTemplate, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { RuleCard } from '@/components/rule-card';
import { RuleTemplatesBanner } from '@/components/rule-templates-banner';
import { RuleTemplatesSheet } from '@/components/rule-templates-sheet';
import { RulesHelpSheet } from '@/components/rules-help-sheet';
import { SafeAreaView } from '@/components/safe-area-view';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { setRuleEnabled } from '@/db/repositories/rules';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useAction } from '@/db/use-action';
import { addedRuleIds, RULE_TEMPLATES, type RuleTemplate } from '@/domain/rule-templates';
import {
  useDismissRuleTemplates,
  useRules,
  useRuleTemplatesDismissed,
} from '@/features/rules/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

export default function RulesScreen() {
  /* One push per press: the row stays tappable for the whole transition. */
  const navigate = useNavigateOnce();

  const rules = useRules();
  const categories = useCategories(true);
  const accounts = useAccounts(true);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const templatesDismissed = useRuleTemplatesDismissed();
  const dismissTemplates = useDismissRuleTemplates();

  /* Matched by name against every rule, paused ones included — a paused
     "Food delivery" is still one the user has. */
  const addedTemplates = useMemo(() => addedRuleIds(rules.data ?? []), [rules.data]);
  const availableTemplates = RULE_TEMPLATES.length - addedTemplates.size;
  /* The categories a template can resolve to. RuleCard needs the archived
     ones too, to name what an old rule points at; a new rule must not. */
  const activeCategories = useMemo(
    () => (categories.data ?? []).filter((category) => !category.isArchived),
    [categories.data],
  );

  /* The banner is the way in until it is closed or there is nothing left to
     offer; after that the compact button beside New takes over. Held back
     until the flag has been read, so it never flashes up and disappears. */
  const showBanner =
    templatesDismissed.data === false && availableTemplates > 0 && rules.error === null;

  const openTemplate = (template: RuleTemplate) => {
    setIsTemplatesOpen(false);
    navigate({ pathname: '/rule/new', params: { template: template.id } });
  };

  const openAddedRule = (ruleId: string) => {
    setIsTemplatesOpen(false);
    navigate(`/rule/${ruleId}`);
  };

  /* The design pass toggled local state, so a rule switched off came back on
     the moment you navigated away. This writes — through useAction, so a failed
     write says so rather than letting the switch snap back unexplained. */
  const toggle = useAction(setRuleEnabled);
  const toggleRule = useCallback(
    (id: string, isEnabled: boolean) => {
      void toggle.run(id, isEnabled);
    },
    [toggle],
  );

  /**
   * Priority is the whole point of the list, so the order on screen *is* the
   * evaluation order. Paused rules are held back rather than dropped — they
   * still exist, they just aren't consulted.
   */
  const sections = useMemo(() => {
    const byPriority = [...(rules.data ?? [])].sort((a, b) => b.priority - a.priority);

    return [
      { id: 'active', label: 'Active', rules: byPriority.filter((rule) => rule.isEnabled) },
      { id: 'paused', label: 'Paused', rules: byPriority.filter((rule) => !rule.isEnabled) },
    ].filter((section) => section.rules.length > 0);
  }, [rules.data]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="gap-5 pt-2 pb-4">
        <View className="px-5">
          <ScreenHeader
            trailing={
              <IconButton
                icon={CircleQuestionMark}
                label="How rules work"
                onPress={() => setIsHelpOpen(true)}
              />
            }
          />
        </View>

        <View className="gap-1 px-5">
          <View className="flex-row items-center justify-between gap-3">
            <Typography.Heading type="h2" weight="bold" className="flex-1" truncate>
              Rules
            </Typography.Heading>
            {!showBanner && templatesDismissed.data !== undefined && (
              <Button
                icon={LayoutTemplate}
                label="Templates"
                size="sm"
                tone="secondary"
                accessibilityLabel="Rule templates"
                onPress={() => setIsTemplatesOpen(true)}
              />
            )}
            <Button
              icon={Plus}
              label="New"
              size="sm"
              accessibilityLabel="New rule"
              onPress={() => navigate('/rule/new')}
            />
          </View>
          <Typography type="body-sm" color="muted">
            Checked top to bottom — the first match wins.
          </Typography>
        </View>
      </View>

      {toggle.errorMessage !== null && (
        <View className="px-5 pb-2">
          <Typography type="body-xs" className="text-danger">
            {toggle.errorMessage}
          </Typography>
        </View>
      )}

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
                  onPress={() => navigate(`/rule/${rule.id}`)}
                />
              ))}
            </View>
          </View>
        )}
        contentContainerClassName="gap-6 px-5 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          showBanner ? (
            <RuleTemplatesBanner
              availableCount={availableTemplates}
              onOpen={() => setIsTemplatesOpen(true)}
              onDismiss={() => void dismissTemplates.run()}
            />
          ) : null
        }
        ListEmptyComponent={
          rules.error !== null ? (
            <ErrorState error={rules.error} onRetry={rules.refetch} />
          ) : (
            <EmptyState
              icon={Plus}
              title="No rules yet"
              description="A rule fills in the category and account as you type, so a repeat expense takes four taps."
              /* The banner above is the easier start; this is the other one. */
              action={{
                label: showBanner ? 'Create from scratch' : 'Create a rule',
                icon: Plus,
                onPress: () => navigate('/rule/new'),
              }}
            />
          )
        }
      />

      <RulesHelpSheet isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
      <RuleTemplatesSheet
        isOpen={isTemplatesOpen}
        onOpenChange={setIsTemplatesOpen}
        categories={activeCategories}
        added={addedTemplates}
        onPick={openTemplate}
        onOpenRule={openAddedRule}
      />
    </SafeAreaView>
  );
}
