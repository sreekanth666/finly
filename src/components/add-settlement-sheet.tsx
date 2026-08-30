import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Input, Typography, useBottomSheetAwareHandlers } from 'heroui-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AmountKeypad } from './amount-keypad';
import { Amount } from './amount';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { SectionHeader } from './section-header';

import { accounts } from '@/data/accounts';
import {
  appendKey,
  EMPTY_ENTRY,
  entryToNumber,
  formatEntry,
  type KeypadKey,
} from '@/domain/amount-entry';

type DateChoice = 'today' | 'yesterday' | 'earlier';

const DATE_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'yesterday' as const, label: 'Yesterday' },
  { id: 'earlier' as const, label: 'Earlier…' },
];

const ACCOUNT_OPTIONS = accounts
  .filter((account) => !account.isArchived)
  .map(({ id, name }) => ({ id, label: name }));

export type SettlementDraft = {
  amount: number;
  date: DateChoice;
  accountId: string | null;
  note: string;
};

export type AddSettlementSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** What the expense was for, so the sheet can say what it is settling. */
  expenseTitle: string;
  /** What is still outstanding — a settlement may not exceed it (§5). */
  outstanding: number;
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
  onAdd,
}: AddSettlementSheetProps) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [date, setDate] = useState<DateChoice>('today');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const amount = entryToNumber(entry);
  const exceeds = amount > outstanding;
  const canAdd = amount > 0 && !exceeds;

  const reset = () => {
    setEntry(EMPTY_ENTRY);
    setDate('today');
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
                  {`$${formatEntry(entry)}`}
                </Typography>
                <View className="flex-row items-center gap-1">
                  <Typography type="body-xs" color="muted">
                    of
                  </Typography>
                  <Amount
                    value={outstanding}
                    className="type-amount-sm text-muted"
                    centsClassName="type-amount-sm"
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
                <FilterChipBar options={DATE_OPTIONS} selectedId={date} onSelect={setDate} />
              </View>

              <View className="gap-2">
                <SectionHeader label="Where it landed" />
                <FilterChipBar
                  options={ACCOUNT_OPTIONS}
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
                label="Add settlement"
                isDisabled={!canAdd}
                onPress={() => {
                  onAdd({ amount, date, accountId, note });
                  close(false);
                }}
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
