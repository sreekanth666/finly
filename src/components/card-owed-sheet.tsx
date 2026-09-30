import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Typography, useBottomSheetAwareHandlers } from 'heroui-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AmountInput } from './amount-input';
import { Button } from './button';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import { EMPTY_ENTRY } from '@/domain/amount-entry';
import { entryToMinor, type Minor } from '@/domain/money';

export type CardOwedSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cardName: string;
  /** True once the card is tracked: the sheet then corrects the figure. */
  isAdjusting: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSave: (owedMinor: Minor) => void;
};

function OwedField({ value, onChangeValue }: { value: string; onChangeValue: (v: string) => void }) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <AmountInput
      value={value}
      onChangeValue={onChangeValue}
      accessibilityLabel="Owed today"
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

/**
 * What a card owes today, read off the card's own app or statement (D20).
 *
 * The first time, it starts the card being tracked. After that it corrects it —
 * interest, a fee or a purchase never entered all move the real balance without
 * anything in Finly to show for it, and re-anchoring is the honest fix.
 * An empty field means zero: a card paid off in full owes nothing.
 */
export function CardOwedSheet({
  isOpen,
  onOpenChange,
  cardName,
  isAdjusting,
  isSubmitting = false,
  errorMessage = null,
  onSave,
}: CardOwedSheetProps) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);

  const close = (open: boolean) => {
    onOpenChange(open);
    if (!open) setEntry(EMPTY_ENTRY);
  };

  /* Empty on every open, including after a save closed it from the screen. */
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setEntry(EMPTY_ENTRY);
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={close}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['62%']}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          keyboardBehavior="extend">
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-5 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>{isAdjusting ? 'Adjust balance' : 'Track what you owe'}</BottomSheet.Title>
                <BottomSheet.Description>
                  {isAdjusting
                    ? `Enter what ${cardName} owes today, from its app or statement. It replaces the figure here and counts on from now.`
                    : `Enter what ${cardName} owes today, from its app or statement. From now on, spending on the card adds to it and payments bring it down.`}
                </BottomSheet.Description>
              </View>

              <View className="items-center gap-1">
                <Typography type="body-xs" color="muted">
                  Owed today
                </Typography>
                <OwedField value={entry} onChangeValue={setEntry} />
                <Typography type="body-xs" color="muted">
                  Leave it empty if nothing is owed.
                </Typography>
              </View>

              {errorMessage !== null && (
                <Typography type="body-xs" className="text-danger">
                  {errorMessage}
                </Typography>
              )}

              <Button
                label={isSubmitting ? 'Saving…' : isAdjusting ? 'Save balance' : 'Start tracking'}
                isDisabled={isSubmitting}
                onPress={() => onSave(entryToMinor(entry))}
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
