import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Input, Typography, useBottomSheetAwareHandlers } from 'heroui-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AmountInput } from './amount-input';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { SectionHeader } from './section-header';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import type { AccountRow } from '@/db/schema';
import { EMPTY_ENTRY } from '@/domain/amount-entry';
import { entryToMinor, formatMinor, minorToEntry, type Minor } from '@/domain/money';
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

/*
 * Today is the moment itself, not midday: a card anchored this afternoon counts
 * from that instant (D20), and a payment made after it but stamped at noon would
 * fall before the anchor and never be subtracted. An earlier day is midday, as
 * elsewhere, since only its date is known.
 */
const instantFor = (choice: DayChoice, now: number): number =>
  choice === 'today' ? now : middayOf(now - MS_PER_DAY);

export type CardPaymentDraft = {
  amountMinor: Minor;
  /** Epoch ms. */
  paidAt: number;
  fromAccountId: string | null;
  note: string;
};

export type RecordCardPaymentSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cardId: string;
  cardName: string;
  /** What the card owes, when it is tracked — offered as a one-tap amount. */
  owedMinor: Minor | null;
  accounts: readonly AccountRow[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onRecord: (draft: CardPaymentDraft) => void;
};

/**
 * Split out because `useBottomSheetAwareHandlers` only works from inside
 * `BottomSheet.Content` — called outside one it returns no-ops and the keyboard
 * covers the field. The settlement sheet does the same.
 */
function NoteField({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <Input
      placeholder="September statement"
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

function AmountField({ value, onChangeValue }: { value: string; onChangeValue: (v: string) => void }) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <AmountInput
      value={value}
      onChangeValue={onChangeValue}
      accessibilityLabel="Amount paid"
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

/**
 * Records paying a card's bill (D20). Not an expense: the purchases it pays for
 * were counted when they happened, so this only lowers what the card owes.
 */
export function RecordCardPaymentSheet({
  isOpen,
  onOpenChange,
  cardId,
  cardName,
  owedMinor,
  accounts,
  isSubmitting = false,
  errorMessage = null,
  onRecord,
}: RecordCardPaymentSheetProps) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [day, setDay] = useState<DayChoice>('today');
  const [paidAt, setPaidAt] = useState(() => Date.now());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const amountMinor = entryToMinor(entry);
  const canRecord = amountMinor > 0 && !isSubmitting;

  /* The card cannot pay itself; every other live account might have. */
  const fromOptions = accounts
    .filter((account) => !account.isArchived && account.id !== cardId)
    .map(({ id, name }) => ({ id, label: name }));

  const reset = () => {
    setEntry(EMPTY_ENTRY);
    /* No clock here: this runs while rendering, and "Today" is resolved when
       the payment is saved, so the stored instant has nothing to go stale. */
    setDay('today');
    setIsPickerOpen(false);
    setFromAccountId(null);
    setNote('');
  };

  const close = (open: boolean) => {
    onOpenChange(open);
    if (!open) reset();
  };

  /*
   * Fresh on every open, not only on a dismissal. A successful save closes the
   * sheet from the screen, which never passes through `close` above — so the
   * last amount would still be sitting there, one tap from a duplicate. Done
   * while rendering rather than by remounting: a sheet mounted a frame ago has
   * not been laid out, and gorhom drops the open request (see TransactionFilters).
   */
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) reset();
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={close}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['88%']}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          keyboardBehavior="extend">
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-5 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>Record payment</BottomSheet.Title>
                <BottomSheet.Description>
                  {`Money paid toward ${cardName}. It lowers what the card owes and is not counted as spending — the purchases already were.`}
                </BottomSheet.Description>
              </View>

              <View className="items-center gap-1">
                <Typography type="body-xs" color="muted">
                  Paid
                </Typography>
                <AmountField value={entry} onChangeValue={setEntry} />
                {owedMinor !== null && owedMinor > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setEntry(minorToEntry(owedMinor))}
                    className="active:opacity-60">
                    <Typography type="body-xs" className="text-link">
                      {`Pay the full ${formatMinor(owedMinor)} owed`}
                    </Typography>
                  </Pressable>
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
                    else setPaidAt(instantFor(choice, Date.now()));
                  }}
                />
                <Typography type="body-xs" color="muted">
                  {day === 'today' ? 'Today' : formatDayLabel(paidAt)}
                </Typography>
                {isPickerOpen && (
                  <DateTimePicker
                    value={new Date(paidAt)}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onValueChange={(_event, date) => {
                      const now = Date.now();
                      setPaidAt(
                        startOfLocalDay(date.getTime()) === startOfLocalDay(now)
                          ? now
                          : middayOf(date.getTime()),
                      );
                      setIsPickerOpen(false);
                    }}
                    onDismiss={() => setIsPickerOpen(false)}
                  />
                )}
              </View>

              {fromOptions.length > 0 && (
                <View className="gap-2">
                  <SectionHeader label="Paid from" />
                  <FilterChipBar
                    options={fromOptions}
                    selectedId={fromAccountId}
                    onSelect={(id) => setFromAccountId(fromAccountId === id ? null : id)}
                  />
                </View>
              )}

              <View className="gap-2">
                <SectionHeader label="Note" />
                <NoteField value={note} onChangeText={setNote} />
              </View>

              {errorMessage !== null && (
                <Typography type="body-xs" className="text-danger">
                  {errorMessage}
                </Typography>
              )}

              <Button
                label={isSubmitting ? 'Saving…' : 'Record payment'}
                isDisabled={!canRecord}
                /* "Today" is the moment of saving, not of opening: the card may
                   have been anchored in between, and a payment stamped before
                   its anchor is never subtracted (D20). */
                onPress={() =>
                  onRecord({
                    amountMinor,
                    paidAt: day === 'today' ? Date.now() : paidAt,
                    fromAccountId,
                    note,
                  })
                }
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
