import { Typography } from 'heroui-native';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, type LayoutRectangle } from 'react-native';

import { Icon } from './icon';

export type FilterOption<Id extends string> = {
  id: Id;
  label: string;
};

export type FilterChipBarProps<Id extends string> = {
  options: FilterOption<Id>[];
  /** null leaves every pill unselected — a field that hasn't been answered yet. */
  selectedId: Id | null;
  onSelect: (id: Id) => void;
  /**
   * Adds a leading "+ New" pill. First rather than last so it is visible
   * without scrolling — the point is to not have to go looking for it.
   */
  onCreate?: () => void;
  /**
   * What the create pill makes, for screen readers — "New category". The pill
   * itself only says "New"; the row it sits in already says what of.
   */
  createLabel?: string;
};

/** The content container's `px-5`, which a scroll-into-view has to clear too. */
const EDGE_INSET = 20;

/**
 * Class strings are spelled out per state rather than built from a template, so
 * the CSS compiler can see every utility this component can render — the same
 * reason StatCard does it.
 *
 * The pill is a plain Pressable rather than HeroUI's Chip: Chip colors its
 * label through a `variant`-x-`color` compound class, which is defined in
 * heroui-native's stylesheet and therefore outranks any `text-*` utility passed
 * to `Chip.Label` (global.css imports heroui after Tailwind). That left the
 * selected pill's text outside our control. Here both the fill and the label
 * come from the same entry below, so they can never disagree.
 *
 * Selected carries a border in its own fill color so both states measure the
 * same and the row doesn't shift by a pixel as the selection moves. The create
 * pill's dashed border is the same width for the same reason.
 */
const STATES = {
  selected: {
    pill: 'rounded-full border border-accent bg-accent px-4 py-2 active:opacity-60',
    label: 'text-accent-foreground',
  },
  idle: {
    pill: 'rounded-full border border-border bg-default px-4 py-2 active:opacity-60',
    label: 'text-foreground',
  },
  create: {
    pill: 'flex-row items-center gap-1 rounded-full border border-dashed border-border px-3.5 py-2 active:opacity-60',
    label: 'text-muted',
  },
} as const;

/**
 * Horizontally scrolling row of filter pills. Full-bleed — the padding lives on
 * the content container so the last pill runs off the edge rather than stopping
 * short of it, which is what signals there is more to scroll.
 *
 * `keyboardShouldPersistTaps` has to be set here as well as on the form around
 * it. A ScrollView left at the default claims the first tap while the keyboard
 * is up and spends it dismissing the keyboard, and a nested one does that even
 * when its parent persists taps — so picking a category straight after typing
 * the item took two taps, and looked like the first one had missed.
 *
 * A selection made from outside the row — a rule filling in the category, a
 * category just created from the "New" pill — can land on a pill scrolled out of
 * sight, which reads as nothing having happened. So the selected pill is
 * scrolled into view whenever it changes, or first appears. A pill the user
 * tapped is already in view, and nothing moves.
 */
export function FilterChipBar<Id extends string>({
  options,
  selectedId,
  onSelect,
  onCreate,
  createLabel = 'New',
}: FilterChipBarProps<Id>) {
  const scrollRef = useRef<ScrollView>(null);
  /* All three are only touched from layout and scroll callbacks, never while
     rendering — they describe where things are, which is not render state. */
  const pillFrames = useRef(new Map<string, LayoutRectangle>());
  const viewportWidth = useRef(0);
  const scrollX = useRef(0);

  const reveal = useCallback((frame: LayoutRectangle | undefined) => {
    if (frame === undefined || viewportWidth.current === 0) return;

    const left = frame.x - EDGE_INSET;
    const right = frame.x + frame.width + EDGE_INSET - viewportWidth.current;

    if (left < scrollX.current) {
      scrollRef.current?.scrollTo({ x: Math.max(0, left), animated: true });
    } else if (right > scrollX.current) {
      scrollRef.current?.scrollTo({ x: right, animated: true });
    }
  }, []);

  /* A pill that is already laid out. One that has not mounted yet — a category
     created a moment ago — is revealed from its own onLayout below. */
  useEffect(() => {
    if (selectedId !== null) reveal(pillFrames.current.get(selectedId));
  }, [selectedId, reveal]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={(event) => {
        viewportWidth.current = event.nativeEvent.layout.width;
        /* The pills may have reported before the row knew its own width, in
           which case their reveal was a no-op — an edit form opening on a
           category far down the list. */
        if (selectedId !== null) reveal(pillFrames.current.get(selectedId));
      }}
      onScroll={(event) => {
        scrollX.current = event.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={64}
      contentContainerClassName="gap-2 px-5">
      {onCreate !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createLabel}
          onPress={onCreate}
          className={STATES.create.pill}>
          <Icon icon={Plus} color="muted" size={14} />
          <Typography type="body-sm" weight="medium" className={STATES.create.label}>
            New
          </Typography>
        </Pressable>
      )}

      {options.map(({ id, label }) => {
        const isSelected = id === selectedId;
        const styles = isSelected ? STATES.selected : STATES.idle;

        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(id)}
            onLayout={(event) => {
              const frame = event.nativeEvent.layout;
              pillFrames.current.set(id, frame);
              if (isSelected) reveal(frame);
            }}
            className={styles.pill}>
            <Typography type="body-sm" weight="medium" className={styles.label}>
              {label}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
