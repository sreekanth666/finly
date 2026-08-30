import { Input, Switch, Typography } from 'heroui-native';
import { Minus, Plus, Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { SectionHeader } from './section-header';

import { CATEGORIES, type CategoryId } from '@/data/categories';
import {
  OPERATOR_LABELS,
  type RuleCondition,
  type RuleConditionField,
  type RuleConditionOperator,
} from '@/data/rules';
import { useDbQuery, type TableName } from '@/db/live';
import { listAccounts } from '@/db/repositories/accounts';
import { listMatchTargets } from '@/db/repositories/expenses';
import { countMatches, ruleMatches } from '@/domain/rules';

export type RuleDraft = {
  name: string;
  isEnabled: boolean;
  priority: string;
  matchMode: 'all' | 'any';
  conditions: RuleCondition[];
  categoryId: CategoryId | null;
  accountName: string | null;
  /** null leaves the budget flag alone; a rule need not touch every field. */
  countsToBudget: boolean | null;
};

const EMPTY_CONDITION: RuleCondition = { field: 'item', operator: 'contains', value: '' };

const EMPTY_DRAFT: RuleDraft = {
  name: '',
  isEnabled: true,
  priority: '50',
  matchMode: 'all',
  conditions: [EMPTY_CONDITION],
  categoryId: null,
  accountName: null,
  countsToBudget: null,
};

const MATCH_MODES = [
  { id: 'all' as const, label: 'Match all' },
  { id: 'any' as const, label: 'Match any' },
];

const FIELDS = [
  { id: 'item' as const, label: 'Item' },
  { id: 'note' as const, label: 'Note' },
];

const OPERATORS = (Object.keys(OPERATOR_LABELS) as RuleConditionOperator[]).map((id) => ({
  id,
  label: OPERATOR_LABELS[id],
}));

const CATEGORY_OPTIONS = (Object.keys(CATEGORIES) as CategoryId[])
  .filter((id) => !CATEGORIES[id].isArchived)
  .map((id) => ({ id, label: CATEGORIES[id].label }));



const BUDGET_OPTIONS = [
  { id: 'leave' as const, label: 'Leave alone' },
  { id: 'counts' as const, label: 'Counts to budget' },
  { id: 'excluded' as const, label: 'Off budget' },
];

/** Every expense the preview is judged against. */
/**
 * The rule preview reads real expenses now. It used to be a module-scope
 * snapshot of the fixture, which meant the "matches N of M" figure was fixed at
 * import time and could never answer the question it was asking.
 *
 * Capped rather than unbounded: the preview is a sanity check on a rule being
 * written, and scanning the last few hundred expenses answers that as well as
 * scanning ten thousand would.
 */
const MATCH_TARGET_LIMIT = 500;
const TARGET_TABLES: readonly TableName[] = ['expenses'];

const PREVIEW_LIMIT = 3;

export type RuleEditorProps = {
  title: string;
  initial?: Partial<RuleDraft>;
  submitLabel: string;
  onSubmit: (draft: RuleDraft) => void;
  onClose: () => void;
};

/**
 * One editor, two routes — the same split as ExpenseForm and AccountEditor.
 *
 * The match preview is the point of the screen: §7.5 asks that a rule can be
 * judged before it is saved, so the count and its examples recompute on every
 * keystroke rather than waiting for a save.
 */
export function RuleEditor({ title, initial, submitLabel, onSubmit, onClose }: RuleEditorProps) {
  const [draft, setDraft] = useState<RuleDraft>({ ...EMPTY_DRAFT, ...initial });

  const targetsQuery = useDbQuery(`match-targets:${MATCH_TARGET_LIMIT}`, TARGET_TABLES, (database) =>
    listMatchTargets(MATCH_TARGET_LIMIT, database),
  );
  const targets = targetsQuery.data ?? [];

  /* Rules still name an account rather than referencing one; M5 moves the
     rules tables onto account ids along with the rest of that milestone. */
  const accountsQuery = useDbQuery('rule-editor:accounts', ['accounts'], (database) =>
    listAccounts({}, database),
  );
  const accountOptions = (accountsQuery.data ?? []).map(({ name }) => ({ id: name, label: name }));

  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setCondition = (index: number, patch: Partial<RuleCondition>) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition, i) =>
        i === index ? { ...condition, ...patch } : condition
      ),
    }));

  const addCondition = () =>
    setDraft((current) => ({ ...current, conditions: [...current.conditions, EMPTY_CONDITION] }));

  const removeCondition = (index: number) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.filter((_, i) => i !== index),
    }));

  const matches = useMemo(
    () => targets.filter((target) => ruleMatches(draft, target)),
    [draft, targets]
  );
  const matchCount = useMemo(() => countMatches(draft, targets), [draft, targets]);

  const hasAction =
    draft.categoryId !== null || draft.accountName !== null || draft.countsToBudget !== null;
  const canSave =
    draft.name.trim().length > 0 &&
    draft.conditions.some((condition) => condition.value.trim().length > 0) &&
    hasAction;

  const budgetChoice =
    draft.countsToBudget === null ? 'leave' : draft.countsToBudget ? 'counts' : 'excluded';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={X} label="Close" onPress={onClose} />
        <Typography type="body" weight="semibold" className="flex-1">
          {title}
        </Typography>
        <Switch
          isSelected={draft.isEnabled}
          onSelectedChange={(value) => set('isEnabled', value)}
          accessibilityLabel="Rule enabled"
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="gap-2 px-5">
          <SectionHeader label="Name" />
          <Input
            placeholder="Food delivery"
            value={draft.name}
            onChangeText={(value) => set('name', value)}
          />
        </View>

        {/* --- Conditions ------------------------------------------------ */}
        <View className="gap-2">
          <View className="px-5">
            <SectionHeader
              label="When"
              trailing={
                <Typography type="body-sm" color="muted">
                  {draft.conditions.length === 1
                    ? '1 condition'
                    : `${draft.conditions.length} conditions`}
                </Typography>
              }
            />
          </View>

          {draft.conditions.length > 1 && (
            <FilterChipBar
              options={MATCH_MODES}
              selectedId={draft.matchMode}
              onSelect={(mode) => set('matchMode', mode)}
            />
          )}

          <View className="gap-3 px-5">
            {draft.conditions.map((condition, index) => (
              <View key={index} className="gap-2 rounded-3xl bg-surface p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <Typography type="body-xs" color="muted">
                    {index === 0 ? 'Where' : draft.matchMode === 'all' ? 'and where' : 'or where'}
                  </Typography>
                  {draft.conditions.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove condition ${index + 1}`}
                      onPress={() => removeCondition(index)}
                      className="size-7 items-center justify-center rounded-lg active:bg-surface-secondary">
                      <Icon icon={Minus} color="muted" size={14} />
                    </Pressable>
                  )}
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {FIELDS.map((field) => (
                    <Pressable
                      key={field.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: condition.field === field.id }}
                      onPress={() =>
                        setCondition(index, { field: field.id as RuleConditionField })
                      }
                      className={
                        condition.field === field.id
                          ? 'rounded-full border border-accent bg-accent px-3 py-1.5'
                          : 'rounded-full border border-border bg-default px-3 py-1.5 active:opacity-60'
                      }>
                      <Typography
                        type="body-xs"
                        weight="medium"
                        className={
                          condition.field === field.id ? 'text-accent-foreground' : 'text-foreground'
                        }>
                        {field.label}
                      </Typography>
                    </Pressable>
                  ))}

                  {OPERATORS.map((operator) => (
                    <Pressable
                      key={operator.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: condition.operator === operator.id }}
                      onPress={() => setCondition(index, { operator: operator.id })}
                      className={
                        condition.operator === operator.id
                          ? 'rounded-full border border-iris bg-iris px-3 py-1.5'
                          : 'rounded-full border border-border bg-default px-3 py-1.5 active:opacity-60'
                      }>
                      <Typography
                        type="body-xs"
                        weight="medium"
                        className={
                          condition.operator === operator.id
                            ? 'text-iris-foreground'
                            : 'text-foreground'
                        }>
                        {operator.label}
                      </Typography>
                    </Pressable>
                  ))}
                </View>

                <Input
                  placeholder="swiggy"
                  value={condition.value}
                  onChangeText={(value) => setCondition(index, { value })}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <Button tone="secondary" icon={Plus} label="Add condition" onPress={addCondition} />
          </View>
        </View>

        {/* --- Actions --------------------------------------------------- */}
        <View className="gap-2">
          <View className="px-5">
            <SectionHeader
              label="Then fill in"
              trailing={
                <Typography type="body-sm" color="muted">
                  Tap again to clear
                </Typography>
              }
            />
          </View>

          <View className="gap-1">
            <Typography type="body-xs" color="muted" className="px-5">
              Category
            </Typography>
            <FilterChipBar
              options={CATEGORY_OPTIONS}
              selectedId={draft.categoryId}
              onSelect={(id) => set('categoryId', draft.categoryId === id ? null : id)}
            />
          </View>

          <View className="gap-1 pt-2">
            <Typography type="body-xs" color="muted" className="px-5">
              Account
            </Typography>
            <FilterChipBar
              options={accountOptions}
              selectedId={draft.accountName}
              onSelect={(id) => set('accountName', draft.accountName === id ? null : id)}
            />
          </View>

          <View className="gap-1 pt-2">
            <Typography type="body-xs" color="muted" className="px-5">
              Budget
            </Typography>
            <FilterChipBar
              options={BUDGET_OPTIONS}
              selectedId={budgetChoice}
              onSelect={(choice) =>
                set('countsToBudget', choice === 'leave' ? null : choice === 'counts')
              }
            />
          </View>

          {!hasAction && (
            <Typography type="body-xs" color="muted" className="px-5 pt-1">
              A rule has to fill in at least one field to be worth running.
            </Typography>
          )}
        </View>

        {/* --- Live preview ---------------------------------------------- */}
        <View className="gap-2 px-5">
          <SectionHeader
            label="Match preview"
            trailing={
              <Typography type="body-sm" color="muted">
                {`${targets.length} expenses`}
              </Typography>
            }
          />

          <View className="gap-3 rounded-3xl bg-surface p-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={Sparkles} color={matchCount > 0 ? 'accent' : 'muted'} size={14} />
              <Typography type="body-sm" weight="semibold">
                {matchCount === 0
                  ? 'Nothing matches yet'
                  : `Matches ${matchCount} of ${targets.length}`}
              </Typography>
            </View>

            {matches.slice(0, PREVIEW_LIMIT).map((match) => (
              <Typography key={match.id} type="body-xs" color="muted" truncate>
                {`· ${match.item}`}
              </Typography>
            ))}

            {matchCount > PREVIEW_LIMIT && (
              <Typography type="body-xs" color="muted">
                {`and ${matchCount - PREVIEW_LIMIT} more`}
              </Typography>
            )}

            <Typography type="body-xs" color="muted">
              Counted against the expenses already recorded. Saving a rule changes what happens
              next, never what is already filed.
            </Typography>
          </View>
        </View>

        {/* --- Priority --------------------------------------------------- */}
        <View className="gap-2 px-5">
          <SectionHeader label="Priority" />
          <Input
            placeholder="50"
            value={draft.priority}
            onChangeText={(value) => set('priority', value.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Typography type="body-xs" color="muted">
            Higher runs first. When two rules both match, the higher number wins and the other
            never sees the expense.
          </Typography>
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 pt-3">
        <Button label={submitLabel} isDisabled={!canSave} onPress={() => onSubmit(draft)} />
      </View>
    </SafeAreaView>
  );
}
