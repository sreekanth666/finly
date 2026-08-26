import { router } from 'expo-router';
import { Input, Switch, Typography } from 'heroui-native';
import { Sparkles, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountKeypad } from '@/components/amount-keypad';
import { Button } from '@/components/button';
import { FilterChipBar } from '@/components/filter-chip-bar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { accounts, findAccountByName } from '@/data/accounts';
import { CATEGORIES, type CategoryId } from '@/data/categories';
import { rules } from '@/data/rules';
import {
  appendKey,
  EMPTY_ENTRY,
  entryToNumber,
  formatEntry,
  type KeypadKey,
} from '@/domain/amount-entry';
import { matchRule } from '@/domain/rules';

type DateChoice = 'today' | 'yesterday' | 'earlier';

const DATE_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'yesterday' as const, label: 'Yesterday' },
  { id: 'earlier' as const, label: 'Earlier…' },
];

const CATEGORY_OPTIONS = (Object.keys(CATEGORIES) as CategoryId[])
  .filter((id) => id !== 'income')
  .map((id) => ({ id, label: CATEGORIES[id].label }));

const ACCOUNT_OPTIONS = accounts.map(({ id, name }) => ({ id, label: name }));

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

export default function NewExpenseScreen() {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [isKeypadOpen, setIsKeypadOpen] = useState(true);
  const [item, setItem] = useState('');
  const [note, setNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [date, setDate] = useState<DateChoice>('today');

  /* Chosen values, and whether the user has taken a field off the rule. */
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [countsToBudget, setCountsToBudget] = useState(true);
  const [overridden, setOverridden] = useState({
    category: false,
    account: false,
    counts: false,
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

  const canSave = entryToNumber(entry) > 0 && item.trim().length > 0;

  const openKeypad = () => setIsKeypadOpen(true);

  /** Save & add another keeps the date and the account, per §7.2. */
  const resetForNext = () => {
    if (activeAccountId) {
      setAccountId(activeAccountId);
      setOverridden({ category: false, account: true, counts: false });
    } else {
      setOverridden({ category: false, account: false, counts: false });
    }

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
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          New expense
        </Typography>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit amount"
        onPress={openKeypad}
        className="items-center gap-1 px-5 py-6 active:opacity-60">
        <Typography type="body-xs" color="muted">
          Amount
        </Typography>
        <Typography className={entry.length > 0 ? 'type-metric text-foreground' : 'type-metric text-muted'}>
          {`$${formatEntry(entry)}`}
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
                {`Filled in by “${fill.rule.name}” — change anything below to override it.`}
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
          <View className="flex-1">
            <Button
              tone="secondary"
              label="Save & add another"
              isDisabled={!canSave}
              onPress={resetForNext}
            />
          </View>
          <View className="flex-1">
            <Button label="Save" isDisabled={!canSave} onPress={() => router.back()} />
          </View>
        </View>

        {isKeypadOpen && (
          <AmountKeypad onKeyPress={(key: KeypadKey) => setEntry((current) => appendKey(current, key))} />
        )}
      </View>
    </SafeAreaView>
  );
}
