import { Typography } from 'heroui-native';
import { Pressable, ScrollView } from 'react-native';

export type FilterOption<Id extends string> = {
  id: Id;
  label: string;
};

export type FilterChipBarProps<Id extends string> = {
  options: FilterOption<Id>[];
  selectedId: Id;
  onSelect: (id: Id) => void;
};

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
 * same and the row doesn't shift by a pixel as the selection moves.
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
} as const;

/**
 * Horizontally scrolling row of filter pills. Full-bleed — the padding lives on
 * the content container so the last pill runs off the edge rather than stopping
 * short of it, which is what signals there is more to scroll.
 */
export function FilterChipBar<Id extends string>({
  options,
  selectedId,
  onSelect,
}: FilterChipBarProps<Id>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-5">
      {options.map(({ id, label }) => {
        const isSelected = id === selectedId;
        const styles = isSelected ? STATES.selected : STATES.idle;

        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(id)}
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
