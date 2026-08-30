import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Input, Switch, Typography } from 'heroui-native';
import { Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AmountKeypad } from './amount-keypad';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { SafeAreaView } from './safe-area-view';
import { SectionHeader } from './section-header';

import type { AccountRow, CategoryRow } from '@/db/schema';
import { appendKey, EMPTY_ENTRY, type KeypadKey } from '@/domain/amount-entry';
import { entryToMinor, formatEntry, type Minor } from '@/domain/money';
import { formatDayLabel, startOfLocalDay } from '@/domain/period';
import { matchRule, type Rule } from '@/domain/rules';
import { useAppColor } from '@/theme';

/**
 * What the form hands back. `occurredAt` is a real instant now — the design pass
 * carried a three-value `'today' | 'yesterday' | 'earlier'` enum, which lost the
 * actual date on the way in and could not reconstruct it on the way out.
 */
export type ExpenseDraft = {
  amountMinor: Minor;
  item: string;
  note: string;
  categoryId: string | null;
  accountId: string | null;
  countsToBudget: boolean;
  occurredAt: number;
};

export type ExpenseFormSeed = {
  entry: string;
  item: string;
  note: string;
  categoryId: string | null;
  accountId: string | null;
  countsToBudget: boolean;
  occurredAt: number;
};

export type ExpenseFormProps = {
  title: string;
  initial?: Partial<ExpenseFormSeed>;
  categories: readonly CategoryRow[];
  accounts: readonly AccountRow[];
  /** Descriptions used recently, offered under the item field (§7.2). */
  recentItems?: readonly string[];
  /** Enabled rules, evaluated as the item is typed (§4.6). */
  rules?: readonly Rule[];
  /** Told which rule actually filled a saved expense, so its use count moves. */
  onRuleApplied?: (ruleId: string) => void;
  /**
   * Treat every field as already answered, so a matching rule can't rewrite
   * values the expense was saved with. Editing sets this; adding does not.
   */
  isPrefilled?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  /** @param appliedRuleId the rule that decided a field, or null. */
  onSubmit: (draft: ExpenseDraft, appliedRuleId: string | null) => void;
  /**
   * Add-only. Providing it shows the second action. Must resolve true when the
   * expense was actually saved — the form only clears itself on a true result,
   * because clearing after a failed write throws away what the user typed.
   */
  onSubmitAndContinue?: (draft: ExpenseDraft) => Promise<boolean>;
  onClose: () => void;
};

type DayChoice = 'today' | 'yesterday' | 'other';

const DAY_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'yesterday' as const, label: 'Yesterday' },
  { id: 'other' as const, label: 'Pick a date…' },
];

const MS_PER_DAY = 86_400_000;

/** Which chip a stored instant corresponds to, so editing opens on the right one. */
function dayChoiceOf(occurredAt: number, now: number): DayChoice {
  const day = startOfLocalDay(occurredAt);
  if (day === startOfLocalDay(now)) return 'today';
  if (day === startOfLocalDay(now - MS_PER_DAY)) return 'yesterday';
  return 'other';
}

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
  categories,
  accounts,
  recentItems = [],
  rules = [],
  onRuleApplied,
  isPrefilled = false,
  submitLabel,
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onSubmitAndContinue,
  onClose,
}: ExpenseFormProps) {
  /* Frozen when the form opens rather than read each render: the date chips
     compare against it, and a form left open across midnight would otherwise
     silently re-label what the user had already chosen. */
  const [now] = useState(() => Date.now());
  const seed: ExpenseFormSeed = {
    entry: EMPTY_ENTRY,
    item: '',
    note: '',
    categoryId: null,
    accountId: null,
    countsToBudget: true,
    occurredAt: now,
    ...initial,
  };

  const accentColor = useAppColor('accent');

  const [entry, setEntry] = useState(seed.entry);
  /* An expense that already has an amount opens on the fields, not the keypad. */
  const [isKeypadOpen, setIsKeypadOpen] = useState(seed.entry.length === 0);
  const [item, setItem] = useState(seed.item);
  const [note, setNote] = useState(seed.note);
  const [isNoteOpen, setIsNoteOpen] = useState(seed.note.length > 0);
  const [occurredAt, setOccurredAt] = useState(seed.occurredAt);
  const [dayChoice, setDayChoice] = useState<DayChoice>(dayChoiceOf(seed.occurredAt, now));
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  /* Chosen values, and whether the user has taken a field off the rule. */
  const [categoryId, setCategoryId] = useState<string | null>(seed.categoryId);
  const [accountId, setAccountId] = useState<string | null>(seed.accountId);
  const [countsToBudget, setCountsToBudget] = useState(seed.countsToBudget);
  const [overridden, setOverridden] = useState({
    category: isPrefilled,
    account: isPrefilled,
    counts: isPrefilled,
  });

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, label: category.name })),
    [categories],
  );
  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, label: account.name })),
    [accounts],
  );

  /* Rules run as the item is typed — §4.6, highest priority first. */
  const fill = useMemo(() => matchRule(rules, { item, note }), [rules, item, note]);

  const ruleAccount = useMemo(
    () => accounts.find((account) => account.id === fill?.accountId),
    [fill?.accountId, accounts],
  );

  /* A rule only speaks for a field the user hasn't answered themselves. */
  const ruleCategoryId = overridden.category ? null : (fill?.categoryId ?? null);
  const appliedAccount = overridden.account ? undefined : ruleAccount;
  const ruleCounts = overridden.counts ? undefined : fill?.countsToBudget;

  const activeCategoryId = ruleCategoryId ?? categoryId;
  const activeAccountId = appliedAccount?.id ?? accountId;
  const activeCounts = ruleCounts ?? countsToBudget;

  const amountMinor = entryToMinor(entry);
  const canSave = amountMinor > 0 && item.trim().length > 0 && !isSubmitting;

  /**
   * Which rule, if any, actually decided something on the expense being saved.
   * A rule that matched while typing but had every field overridden did not
   * apply, and counting it would make the "used N times" stat meaningless.
   */
  const appliedRuleId = (): string | null => {
    if (fill === null) return null;
    const decided =
      ruleCategoryId !== null || appliedAccount !== undefined || ruleCounts !== undefined;
    return decided ? fill.rule.id : null;
  };

  const draft = (): ExpenseDraft => ({
    amountMinor,
    item,
    note,
    categoryId: activeCategoryId,
    accountId: activeAccountId,
    countsToBudget: activeCounts,
    occurredAt,
  });

  /** Keeps the time of day when only the date changes, so ordering stays sane. */
  const setDay = (choice: DayChoice) => {
    setDayChoice(choice);
    if (choice === 'other') {
      setIsPickerOpen(true);
      return;
    }
    const target = choice === 'today' ? now : now - MS_PER_DAY;
    const clock = occurredAt - startOfLocalDay(occurredAt);
    setOccurredAt(startOfLocalDay(target) + clock);
  };

  /** Save & add another keeps the date and the account, per §7.2. */
  const handleSubmitAndContinue = async () => {
    const ruleId = appliedRuleId();

    /*
     * Everything below wipes the form, so it waits for the write. The earlier
     * version cleared synchronously while the insert was still in flight, which
     * meant a failed save silently discarded the expense the user had just
     * typed — and counted the rule that filled it in.
     */
    const saved = await onSubmitAndContinue?.(draft());
    if (saved !== true) return;

    if (ruleId !== null) onRuleApplied?.(ruleId);

    setOverridden({ category: false, account: activeAccountId !== null, counts: false });
    if (activeAccountId) setAccountId(activeAccountId);

    setEntry(EMPTY_ENTRY);
    setItem('');
    setNote('');
    setIsNoteOpen(false);
    setCategoryId(null);
    setCountsToBudget(true);
    setIsKeypadOpen(true);
  };

  const suggestions = useMemo(() => {
    const typed = item.trim().toLowerCase();
    if (typed.length === 0) return recentItems.slice(0, 4);
    return recentItems
      .filter((recent) => recent.toLowerCase().includes(typed) && recent.toLowerCase() !== typed)
      .slice(0, 4);
  }, [item, recentItems]);

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
          {suggestions.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${suggestion}`}
                  onPress={() => setItem(suggestion)}
                  className="rounded-full bg-surface px-3 py-1.5 active:opacity-60">
                  <Typography type="body-xs" color="muted">
                    {suggestion}
                  </Typography>
                </Pressable>
              ))}
            </View>
          )}
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
            options={categoryOptions}
            selectedId={activeCategoryId}
            onSelect={(id) => {
              setCategoryId(id);
              setOverridden((current) => ({ ...current, category: true }));
            }}
          />
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Account" trailing={appliedAccount ? <RuleBadge /> : undefined} />
          </View>
          {accountOptions.length > 0 ? (
            <FilterChipBar
              options={accountOptions}
              selectedId={activeAccountId}
              onSelect={(id) => {
                setAccountId(id);
                setOverridden((current) => ({ ...current, account: true }));
              }}
            />
          ) : (
            <Typography type="body-xs" color="muted" className="px-5">
              No accounts yet — add one in Settings to track which card paid.
            </Typography>
          )}
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Date" trailing={
              <Typography type="body-xs" color="muted">
                {formatDayLabel(occurredAt, now)}
              </Typography>
            } />
          </View>
          <FilterChipBar options={DAY_OPTIONS} selectedId={dayChoice} onSelect={setDay} />
          {isPickerOpen && (
            <View className="px-5">
              <DateTimePicker
                value={new Date(occurredAt)}
                mode="date"
                display="default"
                accentColor={accentColor}
                maximumDate={new Date(now)}
                onValueChange={(_event, date) => {
                  const clock = occurredAt - startOfLocalDay(occurredAt);
                  setOccurredAt(startOfLocalDay(date.getTime()) + clock);
                  setDayChoice(dayChoiceOf(date.getTime(), now));
                  setIsPickerOpen(false);
                }}
                onDismiss={() => setIsPickerOpen(false)}
              />
            </View>
          )}
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
        {errorMessage !== null && (
          <Typography type="body-xs" className="text-danger">
            {errorMessage}
          </Typography>
        )}

        <View className="flex-row gap-3">
          {onSubmitAndContinue && (
            <View className="flex-1">
              <Button
                tone="secondary"
                label="Save & add another"
                isDisabled={!canSave}
                onPress={() => void handleSubmitAndContinue()}
              />
            </View>
          )}
          <View className="flex-1">
            <Button
              label={isSubmitting ? 'Saving…' : submitLabel}
              isDisabled={!canSave}
              onPress={() => {
                /* onSubmit reports its own success; the rule counter is moved by
                   the route once the write lands, for the same reason. */
                onSubmit(draft(), appliedRuleId());
              }}
            />
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
