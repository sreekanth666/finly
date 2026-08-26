import { router } from 'expo-router';
import { Input, Typography } from 'heroui-native';
import { Archive, ArrowLeft, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ReorderButtons } from '@/components/reorder-buttons';
import { SectionHeader } from '@/components/section-header';
import { CATEGORIES, type Category, type CategoryId } from '@/data/categories';
import { isAtEdge, moveItem } from '@/domain/reorder';

type EditableCategory = Category & { id: CategoryId };

const ROW = {
  first: 'flex-row items-center gap-2 px-3 py-2',
  rest: 'flex-row items-center gap-2 border-t border-border px-3 py-2',
} as const;

const seed = (Object.keys(CATEGORIES) as CategoryId[])
  .map((id) => ({ id, ...CATEGORIES[id] }))
  .sort((a, b) => a.sortOrder - b.sortOrder);

export default function CategoriesSettingsScreen() {
  const [list, setList] = useState<EditableCategory[]>(seed);

  const active = useMemo(() => list.filter((category) => !category.isArchived), [list]);
  const archived = useMemo(() => list.filter((category) => category.isArchived), [list]);

  const move = (category: EditableCategory, direction: -1 | 1) =>
    setList((current) => {
      const order = current.filter((candidate) => !candidate.isArchived);
      const index = order.findIndex((candidate) => candidate.id === category.id);
      const reordered = moveItem(order, index, direction);

      return [...reordered, ...current.filter((candidate) => candidate.isArchived)];
    });

  const update = (id: CategoryId, patch: Partial<EditableCategory>) =>
    setList((current) =>
      current.map((category) => (category.id === id ? { ...category, ...patch } : category))
    );

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

          <View className="rounded-3xl bg-surface">
            {active.map((category, index) => (
              <View key={category.id} className={index === 0 ? ROW.first : ROW.rest}>
                <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                  <Icon icon={category.icon} color={category.tone} size={16} />
                </View>

                <Input
                  value={category.label}
                  onChangeText={(label) => update(category.id, { label })}
                  className="flex-1"
                  accessibilityLabel={`Rename ${category.label}`}
                />

                <ReorderButtons
                  label={category.label}
                  canMoveUp={!isAtEdge(active, index, -1)}
                  canMoveDown={!isAtEdge(active, index, 1)}
                  onMoveUp={() => move(category, -1)}
                  onMoveDown={() => move(category, 1)}
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${category.label}`}
                  onPress={() => update(category.id, { isArchived: true })}
                  className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
                  <Icon icon={Archive} color="muted" size={15} />
                </Pressable>
              </View>
            ))}
          </View>

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
                    <Icon icon={category.icon} color="muted" size={16} />
                  </View>
                  <Typography type="body-sm" color="muted" className="flex-1 px-1" truncate>
                    {category.label}
                  </Typography>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${category.label}`}
                    onPress={() => update(category.id, { isArchived: false })}
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
