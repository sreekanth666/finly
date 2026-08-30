import { router } from 'expo-router';
import { Input, Typography } from 'heroui-native';
import { Archive, ArrowLeft, Plus, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { Button } from '@/components/button';
import { ICON_NAMES, iconFor } from '@/components/icon-registry';
import { IconButton } from '@/components/icon-button';
import { ReorderButtons } from '@/components/reorder-buttons';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import {
  createCategory,
  renameCategory,
  reorderCategories,
  setCategoryArchived,
} from '@/db/repositories/categories';
import type { CategoryRow } from '@/db/schema';
import { isAtEdge, moveItem } from '@/domain/reorder';
import { useAction } from '@/db/use-action';
import { useCategories } from '@/features/catalog/hooks';
import { toAppColor } from '@/theme';

const ROW = {
  first: 'flex-row items-center gap-2 px-3 py-2',
  rest: 'flex-row items-center gap-2 border-t border-border px-3 py-2',
} as const;

export default function CategoriesSettingsScreen() {
  const categories = useCategories(true);

  /*
   * Renames are held locally and committed on blur, deliberately.
   *
   * Writing on every keystroke would fire a change event, which refetches the
   * very list this input belongs to, which replaces the value under the cursor —
   * the caret jumps to the end and characters get dropped. That is a guaranteed
   * bug the moment a live query backs an inline editor, not a hypothetical one.
   */
  /* Writes go through useAction so a rejected rename says why, rather than
     throwing out of a press handler with nothing to catch it. */
  const rename = useAction(renameCategory);
  const reorder = useAction(reorderCategories);
  const archive = useAction(setCategoryArchived);
  /* §7.7 lists categories as manageable, but until now the only way to create
     one was through a CSV import that happened to name an unknown category. */
  const create = useAction(createCategory);
  const [newName, setNewName] = useState('');
  const [iconIndex, setIconIndex] = useState(0);
  const failure =
    rename.errorMessage ?? reorder.errorMessage ?? archive.errorMessage ?? create.errorMessage;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const nameOf = (category: CategoryRow) => drafts[category.id] ?? category.name;

  const commitRename = (category: CategoryRow) => {
    const next = (drafts[category.id] ?? '').trim();
    setDrafts((current) => {
      const { [category.id]: _dropped, ...rest } = current;
      return rest;
    });
    if (next.length === 0 || next === category.name) return;
    void rename.run(category.id, next);
  };

  const active = useMemo(
    () => (categories.data ?? []).filter((category) => !category.isArchived),
    [categories.data],
  );
  const archived = useMemo(
    () => (categories.data ?? []).filter((category) => category.isArchived),
    [categories.data],
  );

  /* moveItem reorders the array; sort_order has to be written back or the order
     resets on the next read. */
  const move = (category: CategoryRow, direction: -1 | 1) => {
    const index = active.findIndex((candidate) => candidate.id === category.id);
    const reordered = moveItem(active, index, direction);
    void reorder.run([...reordered, ...archived].map((row) => row.id));
  };

  const setArchived = (id: string, isArchived: boolean) => {
    void archive.run(id, isArchived);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Categories
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <SectionHeader
            label="Active"
            trailing={
              <Typography type="body-sm" color="muted">
                Tap a name to rename
              </Typography>
            }
          />

          {categories.error !== null ? (
            <ErrorState error={categories.error} onRetry={categories.refetch} />
          ) : (
          <View className="rounded-3xl bg-surface">
            {active.map((category, index) => (
              <View key={category.id} className={index === 0 ? ROW.first : ROW.rest}>
                <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                  <Icon
                    icon={iconFor(category.icon)}
                    color={toAppColor(category.colorToken, 'muted')}
                    size={16}
                  />
                </View>

                <Input
                  value={nameOf(category)}
                  onChangeText={(name) =>
                    setDrafts((current) => ({ ...current, [category.id]: name }))
                  }
                  onBlur={() => commitRename(category)}
                  className="flex-1"
                  accessibilityLabel={`Rename ${category.name}`}
                />

                <ReorderButtons
                  label={category.name}
                  canMoveUp={!isAtEdge(active, index, -1)}
                  canMoveDown={!isAtEdge(active, index, 1)}
                  onMoveUp={() => move(category, -1)}
                  onMoveDown={() => move(category, 1)}
                />

                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${category.name}`}
                  onPress={() => setArchived(category.id, true)}
                  className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
                  <Icon icon={Archive} color="muted" size={15} />
                </Pressable>
              </View>
            ))}
          </View>
          )}

          <View className="gap-2 rounded-3xl bg-surface p-4">
            <Typography type="body-sm" weight="semibold">
              Add a category
            </Typography>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change the icon"
                hitSlop={10}
                onPress={() => setIconIndex((current) => (current + 1) % ICON_NAMES.length)}
                className="size-10 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60">
                <Icon icon={iconFor(ICON_NAMES[iconIndex])} color="muted" size={16} />
              </Pressable>
              <View className="flex-1">
                <Input
                  placeholder="Pets, Travel, Gifts…"
                  value={newName}
                  onChangeText={setNewName}
                  autoCapitalize="words"
                  accessibilityLabel="New category name"
                />
              </View>
            </View>
            <Button
              label="Add"
              icon={Plus}
              size="sm"
              isDisabled={newName.trim().length === 0 || create.isPending}
              onPress={async () => {
                const outcome = await create.run({
                  name: newName,
                  icon: ICON_NAMES[iconIndex] ?? 'Ellipsis',
                  colorToken: 'muted',
                  chartTone: 'chart-5',
                });
                if (outcome.ok) {
                  setNewName('');
                  categories.refetch();
                }
              }}
            />
          </View>

          {failure !== null && (
            <Typography type="body-xs" className="px-1 text-danger">
              {failure}
            </Typography>
          )}

          <Typography type="body-xs" color="muted" className="px-1">
            These are the seeded categories, so they can be archived but not deleted — an expense
            that already points at one must keep resolving.
          </Typography>
        </View>

        {archived.length > 0 && (
          <View className="gap-3">
            <SectionHeader
              label="Archived"
              trailing={
                <Typography type="body-sm" color="muted">
                  {`${archived.length} hidden`}
                </Typography>
              }
            />

            <View className="rounded-3xl bg-surface">
              {archived.map((category, index) => (
                <View key={category.id} className={index === 0 ? ROW.first : ROW.rest}>
                  <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                    <Icon icon={iconFor(category.icon)} color="muted" size={16} />
                  </View>
                  <Typography type="body-sm" color="muted" className="flex-1 px-1" truncate>
                    {category.name}
                  </Typography>
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${category.name}`}
                    onPress={() => setArchived(category.id, false)}
                    className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
                    <Icon icon={RotateCcw} color="muted" size={15} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
