import { Typography } from 'heroui-native';
import { Search, X } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from './icon';
import { iconFor } from './icon-registry';

import { iconLabel, searchIcons, type CategoryIconName } from '@/domain/category-icons';
import { useAppColor } from '@/theme';

/** Spelled out per state so the CSS compiler sees both. */
const TILE = {
  selected: 'size-11 items-center justify-center rounded-xl bg-accent',
  idle: 'size-11 items-center justify-center rounded-xl bg-surface-secondary',
} as const;

/** The tile's 44pt plus the least room a column may have around it. */
const MIN_CELL = 52;

export type IconPickerProps = {
  value: CategoryIconName;
  onChange: (name: CategoryIconName) => void;
  /**
   * Inside a bottom sheet the search field has to tell the sheet about the
   * keyboard, and `useBottomSheetAwareHandlers` only works from inside
   * `BottomSheet.Content` — so the caller that is inside it passes them in.
   */
  onSearchFocus?: TextInputProps['onFocus'];
  onSearchBlur?: TextInputProps['onBlur'];
};

/**
 * Every icon a category may have, as a grid of bare glyphs, with a search over
 * their names and the words people use for them ("rent", "cab", "netflix").
 * Callers show it only on request — it opens from the icon beside the name.
 *
 * The chosen icon stays in the grid whatever the search says, so narrowing it
 * never makes the current choice look like it has gone.
 */
export function IconPicker({
  value,
  onChange,
  onSearchFocus,
  onSearchBlur,
}: IconPickerProps) {
  const mutedColor = useAppColor('muted');
  const [query, setQuery] = useState('');
  /* Measured rather than a fractional class: the column count comes from the
     room there is, and each cell is an exact share of it, so the last column
     ends at the edge on every screen instead of leaving a gap beside it. */
  const [gridWidth, setGridWidth] = useState(0);
  const columns = Math.max(1, Math.floor(gridWidth / MIN_CELL));
  const cellWidth = gridWidth / columns;

  const matches = useMemo(() => searchIcons(query), [query]);
  const shown = matches.includes(value) ? matches : [value, ...matches];

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2 rounded-2xl bg-surface-secondary px-3">
        <Icon icon={Search} color="muted" size={16} />
        <TextInput
          className="type-body-sm flex-1 py-2.5 text-foreground"
          placeholder="Search icons — rent, cab, netflix…"
          placeholderTextColor={mutedColor}
          value={query}
          onChangeText={setQuery}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search icons"
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => setQuery('')}>
            <Icon icon={X} color="muted" size={16} />
          </Pressable>
        )}
      </View>

      <View
        accessibilityRole="radiogroup"
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        className="flex-row flex-wrap">
        {gridWidth > 0 && shown.map((name) => {
          const isSelected = name === value;

          /* Glyphs only on screen; the label is still what a screen reader says. */
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={iconLabel(name)}
              onPress={() => onChange(name)}
              style={{ width: cellWidth }}
              className="items-center py-1 active:opacity-60">
              <View className={isSelected ? TILE.selected : TILE.idle}>
                <Icon
                  icon={iconFor(name)}
                  color={isSelected ? 'accent-foreground' : 'muted'}
                  size={18}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      {matches.length === 0 && (
        <Typography type="body-xs" color="muted">
          {`No icon matches “${query.trim()}”.`}
        </Typography>
      )}
    </View>
  );
}
