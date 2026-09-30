import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Typography } from 'heroui-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { SectionHeader } from './section-header';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import type { AccountRow } from '@/db/schema';

export type ConvertToCardPaymentSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expenseTitle: string;
  /** Live credit cards, the only things a bill payment can be toward. */
  cards: readonly AccountRow[];
  /** The card the expense was logged against, when it was one. */
  suggestedCardId: string | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConvert: (cardId: string) => void;
};

/**
 * "This was a card bill payment" (D20). Before card payments existed, an
 * expense — usually set not to count toward the budget — was the only place to
 * put one, and it counted the card's purchases a second time. This moves it to
 * where it belongs.
 */
export function ConvertToCardPaymentSheet({
  isOpen,
  onOpenChange,
  expenseTitle,
  cards,
  suggestedCardId,
  isSubmitting = false,
  errorMessage = null,
  onConvert,
}: ConvertToCardPaymentSheetProps) {
  const initial = suggestedCardId ?? (cards.length === 1 ? (cards[0]?.id ?? null) : null);
  const [cardId, setCardId] = useState<string | null>(initial);

  /* Back to the suggestion on every open. */
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setCardId(initial);
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setCardId(initial);
      }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['52%']}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          enableDynamicSizing={false}
          contentContainerClassName="h-full">
          <BottomSheetScrollView>
            <View className="gap-5 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>Card bill payment</BottomSheet.Title>
                <BottomSheet.Description>
                  {`“${expenseTitle}” becomes a payment toward the card you pick. It leaves your spending and your budget — the card’s purchases were already counted — and lowers what the card owes.`}
                </BottomSheet.Description>
              </View>

              <View className="gap-2">
                <SectionHeader label="Card paid" />
                <View className="-mx-5">
                  <FilterChipBar
                    options={cards.map(({ id, name }) => ({ id, label: name }))}
                    selectedId={cardId}
                    onSelect={setCardId}
                  />
                </View>
              </View>

              {errorMessage !== null && (
                <Typography type="body-xs" className="text-danger">
                  {errorMessage}
                </Typography>
              )}

              <Button
                label={isSubmitting ? 'Moving…' : 'Move to card payments'}
                isDisabled={cardId === null || isSubmitting}
                onPress={() => {
                  if (cardId !== null) onConvert(cardId);
                }}
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
