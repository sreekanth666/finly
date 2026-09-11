import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Input, Typography, useBottomSheetAwareHandlers } from 'heroui-native';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from './button';
import { Icon } from './icon';
import { ICON_NAMES, iconFor } from './icon-registry';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import { useCreateCategory } from '@/features/catalog/hooks';

export type NewCategorySheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The category to select — new, or the existing one the name already named. */
  onCreated: (id: string) => void;
};

/**
 * Name field, split out because `useBottomSheetAwareHandlers` only works from
 * inside `BottomSheet.Content` — the same reason AddSettlementSheet splits its
 * fields.
 */
function NameField({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
}) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <Input
      placeholder="Pets, Travel, Gifts…"
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      autoCapitalize="words"
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      accessibilityLabel="New category name"
    />
  );
}

/**
 * A category, made without leaving the form that needed it.
 *
 * The expense and rule forms are modal routes holding their drafts in local
 * state, so going to Settings → Categories and back risked the draft and
 * always cost the flow. A sheet over the form never navigates: the form stays
 * mounted underneath with everything in it, and the new category arrives in
 * its picker through the live query like any other write.
 *
 * Same two choices as Settings, name and icon, through the same hook — so a
 * name that already exists selects that category rather than duplicating it.
 */
export function NewCategorySheet({ isOpen, onOpenChange, onCreated }: NewCategorySheetProps) {
  const create = useCreateCategory();
  const [name, setName] = useState('');
  const [iconIndex, setIconIndex] = useState(0);

  const canAdd = name.trim().length > 0 && !create.isPending;

  const close = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setName('');
      setIconIndex(0);
      create.reset();
    }
  };

  const submit = async () => {
    if (!canAdd) return;
    const outcome = await create.run(name.trim(), ICON_NAMES[iconIndex] ?? 'Ellipsis');
    if (!outcome.ok) return;

    onCreated(outcome.value.id);
    close(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={close}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        {/* Pinned rather than dynamic, as every sheet here is: a dynamically
            sized sheet mounts part-way up before it has measured. Short,
            because there are two fields; `interactive` lifts it clear of the
            keyboard rather than growing it to fill the screen. */}
        <BottomSheet.Content
          snapPoints={['45%']}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          keyboardBehavior="interactive">
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-5 pb-8">
              <View className="gap-1">
                <BottomSheet.Title>New category</BottomSheet.Title>
                <BottomSheet.Description>
                  It’s selected for you once it’s added. Rename, reorder or archive it later in
                  Settings.
                </BottomSheet.Description>
              </View>

              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change the icon"
                  hitSlop={10}
                  onPress={() => setIconIndex((current) => (current + 1) % ICON_NAMES.length)}
                  className="size-11 items-center justify-center rounded-xl bg-surface-secondary active:opacity-60">
                  <Icon icon={iconFor(ICON_NAMES[iconIndex])} color="muted" size={18} />
                </Pressable>
                <View className="flex-1">
                  <NameField value={name} onChangeText={setName} onSubmit={() => void submit()} />
                </View>
              </View>

              {create.errorMessage !== null && (
                <Typography type="body-xs" className="text-danger">
                  {create.errorMessage}
                </Typography>
              )}

              <Button
                label={create.isPending ? 'Adding…' : 'Add category'}
                icon={Plus}
                isDisabled={!canAdd}
                onPress={() => void submit()}
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
