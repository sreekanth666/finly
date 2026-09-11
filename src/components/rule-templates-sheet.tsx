import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Typography } from 'heroui-native';
import { Check, ChevronRight, CircleSlash2, Lightbulb } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';
import { iconFor } from './icon-registry';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import type { CategoryRow } from '@/db/schema';
import { findCategoryByName } from '@/domain/categories';
import { RULE_TEMPLATES, type RuleTemplate } from '@/domain/rule-templates';
import { summariseConditions } from '@/features/rules/presentation';
import { toAppColor } from '@/theme';

export type RuleTemplatesSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Active categories only — what a template's category name can resolve to. */
  categories: readonly CategoryRow[];
  /** Template id → the rule already made from it. */
  added: ReadonlyMap<string, string>;
  onPick: (template: RuleTemplate) => void;
  onOpenRule: (ruleId: string) => void;
};

function TemplateCard({
  template,
  category,
  addedRuleId,
  onPress,
}: {
  template: RuleTemplate;
  category: CategoryRow | null;
  addedRuleId: string | undefined;
  onPress: () => void;
}) {
  const isAdded = addedRuleId !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isAdded ? `${template.name}, already added. Open it` : `${template.name}. Open as a new rule`
      }
      onPress={onPress}
      className="gap-3 rounded-3xl bg-surface p-4 active:opacity-60">
      <View className="flex-row items-center gap-3">
        <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
          <Icon
            icon={category === null ? CircleSlash2 : iconFor(category.icon)}
            color={category === null ? 'muted' : toAppColor(category.colorToken, 'muted')}
            size={18}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Typography type="body-sm" weight="semibold" numberOfLines={1}>
            {template.name}
          </Typography>
          {/* A category renamed or archived since install can't be filled in;
              the editor says so and lets them pick. */}
          <Typography type="body-xs" color="muted" numberOfLines={1}>
            {category === null ? 'Pick a category' : `Files under ${category.name}`}
          </Typography>
        </View>
        {isAdded ? (
          <View className="flex-row items-center gap-1">
            <Icon icon={Check} color="accent" size={14} />
            <Typography type="body-xs" weight="medium" className="text-accent">
              Added
            </Typography>
          </View>
        ) : (
          <Icon icon={ChevronRight} color="muted" size={16} />
        )}
      </View>

      <Typography type="body-xs" color="muted">
        {summariseConditions(template.conditions, template.matchMode)}
      </Typography>

      <View className="flex-row flex-wrap gap-2">
        <View className="rounded-full bg-surface-secondary px-2.5 py-1">
          <Typography type="body-xs" color="muted">
            {`Priority ${template.priority}`}
          </Typography>
        </View>
        {template.matchMode === 'all' && (
          <View className="rounded-full bg-surface-secondary px-2.5 py-1">
            <Typography type="body-xs" color="muted">
              Match all
            </Typography>
          </View>
        )}
        {template.countsToBudget === false && (
          <View className="rounded-full bg-surface-secondary px-2.5 py-1">
            <Typography type="body-xs" color="muted">
              Off budget
            </Typography>
          </View>
        )}
      </View>

      <View className="flex-row items-start gap-2">
        <Icon icon={Lightbulb} color="accent" size={14} />
        <Typography type="body-xs" className="flex-1 text-foreground">
          {template.lesson}
        </Typography>
      </View>
    </Pressable>
  );
}

/**
 * Every template, in the order the rules would run once added.
 *
 * Picking one opens the editor already filled in, rather than adding it
 * outright: seeing the conditions, the priority and the match preview is how
 * someone learns to write the next rule themselves, and nothing is saved until
 * they say so. A template already added opens that rule instead, so it can't
 * be added twice by accident.
 *
 * Controlled from the screen and mounted for its whole life, for the reason
 * TransactionFilters gives: a sheet mounted by the press that opens it has not
 * been laid out yet, and the first tap opens nothing.
 */
export function RuleTemplatesSheet({
  isOpen,
  onOpenChange,
  categories,
  added,
  onPick,
  onOpenRule,
}: RuleTemplatesSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        {/* Pinned height and a bounded content container, as every sheet here
            has: dynamic sizing mounts part-way up before it has measured, and
            without the bound the list cannot scroll past the snap point. */}
        <BottomSheet.Content
          snapPoints={['88%']}
          enableDynamicSizing={false}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          contentContainerClassName="h-full">
          <BottomSheetScrollView>
            <View className="gap-4 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>Start from a template</BottomSheet.Title>
                <BottomSheet.Description>
                  Listed in the order they’d run. Each opens in the editor, so you can see how
                  it’s built and change anything before saving.
                </BottomSheet.Description>
              </View>

              {RULE_TEMPLATES.map((template) => {
                const addedRuleId = added.get(template.id);

                return (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    category={findCategoryByName(categories, template.categoryName)}
                    addedRuleId={addedRuleId}
                    onPress={() =>
                      addedRuleId === undefined ? onPick(template) : onOpenRule(addedRuleId)
                    }
                  />
                );
              })}
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
