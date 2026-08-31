import { router } from 'expo-router';
import { Input, Typography } from 'heroui-native';
import { ArrowLeft, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { setProfileName } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { formatPeriodLong } from '@/domain/period';
import { useProfileName, useProfileSummary } from '@/features/profile/hooks';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Who the app thinks it is talking to.
 *
 * There is still no account and no user table (§1) — this is one name in the
 * settings table, shown beside figures the database already holds. It exists so
 * the header avatar has somewhere to go, and so the name asked for during
 * onboarding can be changed by whoever answered it.
 */
export default function ProfileScreen() {
  const stored = useProfileName();
  const summary = useProfileSummary();
  const save = useAction(setProfileName);

  /* Seeded once from the stored name rather than mirrored into state on every
     read: re-seeding would overwrite what is being typed the moment the save
     lands and the query refetches. */
  const [draft, setDraft] = useState<string | null>(null);
  const name = stored.data ?? null;
  const current = draft ?? name ?? '';

  const isChanged = stored.data !== undefined && current.trim() !== (name ?? '');
  const canSave = isChanged && !save.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Profile
        </Typography>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="items-center gap-3">
          {/* The saved name, not the draft: the avatar is what the rest of the
              app shows, and having it change under a half-typed name would
              claim the edit had already landed. */}
          <ProfileAvatar name={name} size="lg" />
          <View className="items-center gap-0.5">
            <Typography type="h4" weight="semibold">
              {name ?? 'No name set'}
            </Typography>
            {summary.data !== undefined && (
              <Typography type="body-xs" color="muted">
                {summary.data.since === null
                  ? 'Nothing logged yet'
                  : `Tracking since ${formatPeriodLong(summary.data.since)}`}
              </Typography>
            )}
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Name" />
          <NameField value={current} onChangeText={setDraft} />
          <Typography type="body-xs" color="muted" className="px-1">
            Only ever stored on this phone, and only used to say hello. Clear it to
            go back to a plain greeting.
          </Typography>
        </View>

        <View className="gap-3">
          <SectionHeader label="So far" />
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              label="Expenses logged"
              value={
                summary.data === undefined
                  ? '—'
                  : plural(summary.data.expenseCount, 'expense', 'expenses')
              }
            />
            <SettingsRow
              isFirst={false}
              label="Spending in"
              value={summary.data?.currency.code ?? '—'}
            />
          </View>
        </View>

        <View className="gap-3">
          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={Settings}
              iconTone="iris"
              label="Settings"
              description="Budget, accounts, categories and data"
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>
      </ScrollView>

      <View className="gap-3 border-t border-border px-5 pt-3">
        {save.errorMessage !== null && (
          <Typography type="body-xs" className="text-danger">
            {save.errorMessage}
          </Typography>
        )}

        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          isDisabled={!canSave}
          /* The draft is deliberately left alone afterwards. Writing to
             `settings` invalidates the query on its own, so the avatar and
             heading above update themselves and Save goes dim once the stored
             name matches — clearing the draft here would instead blank the
             field for the frame between the write and the requery. */
          onPress={() => void save.run(current)}
        />
      </View>
    </SafeAreaView>
  );
}

/** Split out so the keyboard-aware input doesn't re-render the whole screen. */
function NameField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <Input
      placeholder="Your name"
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="words"
      autoComplete="name"
      accessibilityLabel="Your name"
    />
  );
}
