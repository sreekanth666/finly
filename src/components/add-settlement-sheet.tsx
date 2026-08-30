import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Input, Typography, useBottomSheetAwareHandlers } from 'heroui-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AmountKeypad } from './amount-keypad';
import { Amount } from './amount';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { SectionHeader } from './section-header';

import type { AccountRow } from '@/db/schema';
import { appendKey, EMPTY_ENTRY, type KeypadKey } from '@/domain/amount-entry';
import { entryToMinor, formatEntry, type Minor } from '@/domain/money';
import { formatDayLabel, startOfLocalDay } from '@/domain/period';

type DayChoice = 'today' | 'yesterday' | 'other';

const DAY_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'yesterday' as const, label: 'Yesterday' },
  { id: 'other' as const, label: 'Pick a date…' },
];

const MS_PER_DAY = 86_400_000;

/** Midday, so the stored instant cannot drift across a day by a DST hour. */
const middayOf = (ms: number): number => startOfLocalDay(ms) + MS_PER_DAY / 2;

const instantFor = (choice: DayChoice, now: number): number =>
  middayOf(choice === 'today' ? now : now - MS_PER_DAY);

export type SettlementDraft = {
  amountMinor: Minor;
  /** Epoch ms. */
  settledAt: number;
  accountId: string | null;
  note: string;
};

export type AddSettlementSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** What the expense was for, so the sheet can say what it is settling. */
  expenseTitle: string;
  /** What is still outstanding — a settlement may not exceed it (§5). */
  outstanding: Minor;
  accounts: readonly AccountRow[];
  isSubmitting?: boolean;
  onAdd: (draft: SettlementDraft) => void;
};

/**
 * Note field, split out because `useBottomSheetAwareHandlers` only works from
 * inside `BottomSheet.Content` — called outside one it returns no-ops and the
 * keyboard covers the field.
 */
function NoteField({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <Input
      placeholder="Flatmate’s half"
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

/**
 * Records money coming back against an expense. A settlement is a linked record
 * rather than an edit (D1), so this never touches the original amount — it only
 * says how much of it came back.
 */
export function AddSettlementSheet({
  isOpen,
  onOpenChange,
  expenseTitle,
  outstanding,
  accounts,
  isSubmitting = false,
  onAdd,
}: AddSettlementSheetProps) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [day, setDay] = useState<DayChoice>('today');
  /*
   * §4.3's own worked example is a February recharge repaid in March, and
   * Today/Yesterday could not express it — the case the whole settlement
   * design exists for was the one case that could not be entered.
   */
  const [settledAt, setSettledAt] = useState(() => middayOf(Date.now()));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const amountMinor = entryToMinor(entry);
  const exceeds = amountMinor > outstanding;
  const canAdd = amountMinor > 0 && !exceeds && !isSubmitting;

  const accountOptions = accounts
    .filter((account) => !account.isArchived)
    .map(({ id, name }) => ({ id, label: name }));

  const reset = () => {
    setEntry(EMPTY_ENTRY);
    setDay('today');
    setSettledAt(middayOf(Date.now()));
    setIsPickerOpen(false);
    setAccountId(null);
    setNote('');
  };

  const close = (open: boolean) => {
    onOpenChange(open);
    if (!open) reset();
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={close}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['88%']}
          enableOverDrag={false}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          keyboardBehavior="extend">
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-5 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>Add settlement</BottomSheet.Title>
                <BottomSheet.Description>
                  {`Money coming back against ${expenseTitle}. The original expense stays as it is.`}
                </BottomSheet.Description>
              </View>

              <View className="items-center gap-1">
                <Typography type="body-xs" color="muted">
                  Returned
                </Typography>
                <Typography
                  className={
                    entry.length > 0 ? 'type-metric text-foreground' : 'type-metric text-muted'
                  }>
                  {formatEntry(entry)}
                </Typography>
                <View className="flex-row items-center gap-1">
                  <Typography type="body-xs" color="muted">
                    of
                  </Typography>
                  <Amount
                    value={outstanding}
                    className="type-amount-sm text-muted"
                    fractionClassName="type-amount-sm"
                  />
                  <Typography type="body-xs" color="muted">
                    outstanding
                  </Typography>
                </View>
                {exceeds && (
                  <Typography type="body-xs" className="text-danger">
                    More than is outstanding — a settlement can’t exceed the expense.
                  </Typography>
                )}
              </View>

              <View className="gap-2">
                <SectionHeader label="Date" />
                <FilterChipBar
                  options={DAY_OPTIONS}
                  selectedId={day}
                  onSelect={(choice) => {
                    setDay(choice);
                    if (choice === 'other') setIsPickerOpen(true);
                    else setSettledAt(instantFor(choice, Date.now()));
                  }}
                />
                <Typography type="body-xs" color="muted">
                  {formatDayLabel(settledAt)}
                </Typography>
                {isPickerOpen && (
                  <DateTimePicker
                    value={new Date(settledAt)}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onValueChange={(_event, date) => {
                      setSettledAt(middayOf(date.getTime()));
                      setIsPickerOpen(false);
                    }}
                    onDismiss={() => setIsPickerOpen(false)}
                  />
                )}
              </View>

              <View className="gap-2">
                <SectionHeader label="Where it landed" />
                <FilterChipBar
                  options={accountOptions}
                  selectedId={accountId}
                  onSelect={(id) => setAccountId(accountId === id ? null : id)}
                />
              </View>

              <View className="gap-2">
                <SectionHeader label="Note" />
                <NoteField value={note} onChangeText={setNote} />
              </View>

              <AmountKeypad
                onKeyPress={(key: KeypadKey) => setEntry((current) => appendKey(current, key))}
              />

              <Button
                label={isSubmitting ? 'Saving…' : 'Add settlement'}
                isDisabled={!canAdd}
                /* The sheet no longer closes itself: the cap is enforced inside
                   the write, so it is the write that decides whether this
                   settlement was accepted. */
                onPress={() => onAdd({ amountMinor, settledAt, accountId, note })}
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
