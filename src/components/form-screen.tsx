import { Typography } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { IconButton } from './icon-button';
import { SafeAreaView } from './safe-area-view';

/*
 * Both come from a library that knows nothing about uniwind, so `className` on
 * them would be handed over as an ordinary prop and quietly dropped — the exact
 * failure documented at length in ./safe-area-view.tsx, where it collapsed a
 * flex-1 scroll area to nothing. `withUniwind` also maps every `*ClassName`
 * prop to its matching style, so `contentContainerClassName` comes along too.
 */
const Scroll = withUniwind(KeyboardAwareScrollView);
const Sticky = withUniwind(KeyboardStickyView);

/**
 * How much room to keep between the caret and whatever is below it. Roughly the
 * height of the action bar, so a field being typed into is never left sitting
 * under the Save button.
 */
const FOOTER_CLEARANCE = 96;

export type FormScreenProps = {
  /** The standard header. Ignored when `header` is given. */
  title?: string;
  onClose?: () => void;
  /** `X` for a task that is being abandoned, `ArrowLeft` for a place. */
  closeIcon?: LucideIcon;
  closeLabel?: string;
  /** Sits at the end of the header row — the rule editor's enabled switch. */
  headerTrailing?: ReactNode;
  /** Replaces the header row outright, for a screen shaped differently. */
  header?: ReactNode;
  /**
   * Pinned between the header and the scroll area, so it neither scrolls away
   * nor rides the keyboard: the amount display the keypad writes into.
   */
  above?: ReactNode;
  contentContainerClassName?: string;
  /** The action bar. Omitted entirely when there is nothing to put in it. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The shape every form in this app was already: a header, a scrolling body and
 * an action bar pinned under it.
 *
 * It existed six times as copied JSX, and all six had the same bug — nothing in
 * them knew about the keyboard. The action bar is a *sibling* of the scroll
 * view rather than part of it, so the keyboard came up over the Save button and
 * over every field below the one being typed into, and the only way to reach
 * them was to dismiss it first.
 *
 * Now the body is a `KeyboardAwareScrollView`, which scrolls the focused field
 * clear, and the action bar is a `KeyboardStickyView`, which rides up with the
 * keyboard instead of hiding behind it.
 *
 * Not for use inside a bottom sheet. A sheet has its own keyboard handling
 * through gorhom, and the two would fight over the same offsets — see
 * ./add-settlement-sheet.tsx, which uses `useBottomSheetAwareHandlers` instead.
 */
export function FormScreen({
  title,
  onClose,
  closeIcon,
  closeLabel = 'Back',
  headerTrailing,
  header,
  above,
  contentContainerClassName,
  footer,
  children,
}: FormScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {header ?? (
        <View className="flex-row items-center gap-1 px-3 pt-2">
          {closeIcon !== undefined && onClose !== undefined && (
            <IconButton icon={closeIcon} label={closeLabel} onPress={onClose} />
          )}
          <Typography
            type="body"
            weight="semibold"
            className={headerTrailing === undefined ? undefined : 'flex-1'}>
            {title}
          </Typography>
          {headerTrailing}
        </View>
      )}

      {above}

      <Scroll
        className="flex-1"
        contentContainerClassName={contentContainerClassName}
        bottomOffset={FOOTER_CLEARANCE}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </Scroll>

      {footer !== undefined && (
        /*
         * `opened` cancels the bottom safe-area inset. The SafeAreaView above
         * already holds this bar that far clear of the screen edge, and without
         * the correction it would come to rest that same distance above the
         * keyboard rather than sitting on it.
         *
         * `bg-background` is load-bearing, not decoration: the bar now
         * translates *over* the scroll content instead of sitting below it, and
         * anything scrolled underneath would otherwise read straight through.
         */
        <Sticky
          offset={{ opened: insets.bottom }}
          className="gap-3 border-t border-border bg-background px-5 pt-3">
          {footer}
        </Sticky>
      )}
    </SafeAreaView>
  );
}
