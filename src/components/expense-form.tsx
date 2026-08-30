import { Input, Switch, Typography } from 'heroui-native';
import { Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountKeypad } from './amount-keypad';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { SectionHeader } from './section-header';

import { accounts, findAccountByName } from '@/data/accounts';
import { CATEGORIES, type CategoryId } from '@/data/categories';
import { rules } from '@/data/rules';
import { appendKey, EMPTY_ENTRY, type KeypadKey } from '@/domain/amount-entry';
import { entryToMinor, formatEntry } from '@/domain/money';
import { matchRule } from '@/domain/rules';

export type DateChoice = 'today' | 'yesterday' | 'earlier';

export type ExpenseDraft = {
  /** The amount as the keypad holds it, not a number — see domain/amount-entry. */
  entry: string;
  item: string;
  note: string;
  categoryId: CategoryId | null;
  accountId: string | null;
  countsToBudget: boolean;
  date: DateChoice;
};

const EMPTY_DRAFT: ExpenseDraft = {
  entry: EMPTY_ENTRY,
  item: '',
  note: '',
  categoryId: null,
  accountId: null,
  countsToBudget: true,
  date: 'today',
};

const DATE_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'yesterday' as const, label: 'Yesterday' },
  { id: 'earlier' as const, label: 'Earlier…' },
];

const CATEGORY_OPTIONS = (Object.keys(CATEGORIES) as CategoryId[])
  .filter((id) => !CATEGORIES[id].isArchived)
  .map((id) => ({ id, label: CATEGORIES[id].label }));

const ACCOUNT_OPTIONS = accounts.map(({ id, name }) => ({ id, label: name }));

export type ExpenseFormProps = {
  title: string;
  initial?: Partial<ExpenseDraft>;
  /**
   * Treat every field as already answered, so a matching rule can't rewrite
   * values the expense was saved with. Editing sets this; adding does not.
   */
  isPrefilled?: boolean;
  submitLabel: string;
  onSubmit: (draft: ExpenseDraft) => void;
  /** Add-only. Providing it shows the second action and clears the form after. */
  onSubmitAndContinue?: (draft: ExpenseDraft) => void;
  onClose: () => void;
};

/** Marks a field whose value a rule decided, so nothing is filled in silently. */
function RuleBadge() {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5">
      <Icon icon={Sparkles} color="accent" size={10} />
      <Typography type="body-xs" className="text-accent">
        From rule
      </Typography>
    </View>
  );
}

/**
 * The expense form, shared by adding and editing — §7.2 describes one flow, so
 * there is one implementation of it. The two routes differ only in what they
 * seed it with and what the buttons say.
 */
export function ExpenseForm({
  title,
  initial,
  isPrefilled = false,
  submitLabel,
  onSubmit,
  onSubmitAndContinue,
  onClose,
}: ExpenseFormProps) {
  const seed = { ...EMPTY_DRAFT, ...initial };

  const [entry, setEntry] = useState(seed.entry);
  /* An expense that already has an amount opens on the fields, not the keypad. */
  const [isKeypadOpen, setIsKeypadOpen] = useState(seed.entry.length === 0);
  const [item, setItem] = useState(seed.item);
  const [note, setNote] = useState(seed.note);
  const [isNoteOpen, setIsNoteOpen] = useState(seed.note.length > 0);
  const [date, setDate] = useState<DateChoice>(seed.date);

  /* Chosen values, and whether the user has taken a field off the rule. */
  const [categoryId, setCategoryId] = useState<CategoryId | null>(seed.categoryId);
  const [accountId, setAccountId] = useState<string | null>(seed.accountId);
  const [countsToBudget, setCountsToBudget] = useState(seed.countsToBudget);
  const [overridden, setOverridden] = useState({
    category: isPrefilled,
    account: isPrefilled,
    counts: isPrefilled,
  });

  /* Rules run as the item is typed — §4.6, highest priority first. */
  const fill = useMemo(() => matchRule(rules, { item, note }), [item, note]);

  /* A rule only speaks for a field the user hasn't answered themselves. */
  const ruleCategoryId = overridden.category ? null : (fill?.categoryId ?? null);
  const ruleAccount = overridden.account ? undefined : findAccountByName(fill?.accountName);
  const ruleCounts = overridden.counts ? undefined : fill?.countsToBudget;

  const activeCategoryId = ruleCategoryId ?? categoryId;
  const activeAccountId = ruleAccount?.id ?? accountId;
  const activeCounts = ruleCounts ?? countsToBudget;

  const canSave = entryToMinor(entry) > 0 && item.trim().length > 0;

  const draft = (): ExpenseDraft => ({
    entry,
    item,
    note,
    categoryId: activeCategoryId,
    accountId: activeAccountId,
    countsToBudget: activeCounts,
    date,
  });

  /** Save & add another keeps the date and the account, per §7.2. */
  const handleSubmitAndContinue = () => {
    onSubmitAndContinue?.(draft());

    setOverridden({
      category: false,
      account: activeAccountId !== null,
      counts: false,
    });
    if (activeAccountId) setAccountId(activeAccountId);

    setEntry(EMPTY_ENTRY);
    setItem('');
    setNote('');
    setIsNoteOpen(false);
    setCategoryId(null);
    setCountsToBudget(true);
    setIsKeypadOpen(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={X} label="Close" onPress={onClose} />
        <Typography type="body" weight="semibold">
          {title}
        </Typography>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit amount"
        onPress={() => setIsKeypadOpen(true)}
        className="items-center gap-1 px-5 py-6 active:opacity-60">
        <Typography type="body-xs" color="muted">
          Amount
        </Typography>
        <Typography
          className={entry.length > 0 ? 'type-metric text-foreground' : 'type-metric text-muted'}>
          {formatEntry(entry)}
        </Typography>
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="gap-2 px-5">
          <SectionHeader label="Item" />
          <Input
            placeholder="What did you buy?"
            value={item}
            onChangeText={setItem}
            onFocus={() => setIsKeypadOpen(false)}
            autoCapitalize="sentences"
          />
          {fill && (
            <View className="flex-row items-center gap-2 rounded-2xl bg-surface px-3 py-2.5">
              <Icon icon={Sparkles} color="accent" size={14} />
              <Typography type="body-xs" color="muted" className="flex-1">
                {isPrefilled
                  ? `“${fill.rule.name}” matches this item. Nothing was changed for you.`
                  : `Filled in by “${fill.rule.name}” — change anything below to override it.`}
              </Typography>
            </View>
          )}
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Category" trailing={ruleCategoryId ? <RuleBadge /> : undefined} />
          </View>
          <FilterChipBar
            options={CATEGORY_OPTIONS}
            selectedId={activeCategoryId}
            onSelect={(id) => {
              setCategoryId(id);
              setOverridden((current) => ({ ...current, category: true }));
            }}
          />
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Account" trailing={ruleAccount ? <RuleBadge /> : undefined} />
          </View>
          <FilterChipBar
            options={ACCOUNT_OPTIONS}
            selectedId={activeAccountId}
            onSelect={(id) => {
              setAccountId(id);
              setOverridden((current) => ({ ...current, account: true }));
            }}
          />
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Date" />
          </View>
          <FilterChipBar options={DATE_OPTIONS} selectedId={date} onSelect={setDate} />
        </View>

        <View className="gap-2 px-5">
          <SectionHeader
            label="Counts to budget"
            trailing={ruleCounts !== undefined ? <RuleBadge /> : undefined}
          />
          <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
            <Typography type="body-sm" color="muted" className="flex-1">
              {activeCounts ? 'Part of the monthly budget' : 'Tracked, but outside the budget'}
            </Typography>
            <Switch
              isSelected={activeCounts}
              onSelectedChange={(next) => {
                setCountsToBudget(next);
                setOverridden((current) => ({ ...current, counts: true }));
              }}
              accessibilityLabel="Counts to budget"
            />
          </View>
        </View>

        <View className="gap-2 px-5">
          {isNoteOpen ? (
            <>
              <SectionHeader label="Note" />
              <Input
                placeholder="Anything worth remembering"
                value={note}
                onChangeText={setNote}
                onFocus={() => setIsKeypadOpen(false)}
                multiline
                numberOfLines={3}
              />
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsNoteOpen(true)}
              className="self-start active:opacity-60">
              <Typography type="body-sm" className="text-link">
                Add a note
              </Typography>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View className="gap-3 border-t border-border px-5 pt-3">
        <View className="flex-row gap-3">
          {onSubmitAndContinue && (
            <View className="flex-1">
              <Button
                tone="secondary"
                label="Save & add another"
                isDisabled={!canSave}
                onPress={handleSubmitAndContinue}
              />
            </View>
          )}
          <View className="flex-1">
            <Button label={submitLabel} isDisabled={!canSave} onPress={() => onSubmit(draft())} />
          </View>
        </View>

        {isKeypadOpen && (
          <AmountKeypad
            onKeyPress={(key: KeypadKey) => setEntry((current) => appendKey(current, key))}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
