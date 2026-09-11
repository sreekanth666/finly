import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { Switch, Typography } from 'heroui-native';
import { ArrowLeft, BellRing, BellOff, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { formatReminderTime, REMINDER_DAYS, type ReminderTime } from '@/domain/reminders';
import {
  useReminderPermission,
  useReminderSettings,
  useSetReminderEnabled,
  useSetReminderTime,
} from '@/features/reminders/hooks';
import { useAppColor } from '@/theme';

/** A Date on today's calendar at `time`, which is all the picker wants to be seeded with. */
const dateAt = ({ hour, minute }: ReminderTime): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
};

export default function RemindersSettingsScreen() {
  const settings = useReminderSettings();
  const { permission, request } = useReminderPermission();
  const setEnabled = useSetReminderEnabled();
  const setTime = useSetReminderTime();
  const accentColor = useAppColor('accent');

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  /* Set when switching on was refused, so the explanation shows even though
     the switch — correctly — stayed off. */
  const [wasRefused, setWasRefused] = useState(false);

  const isEnabled = settings.data?.enabled ?? false;
  const time = settings.data?.time;

  /*
   * The setting and the OS permission are two facts, and they can disagree: a
   * backup restored onto a new phone brings the setting but not the
   * permission. The sync never schedules without permission, so this is the
   * only place that disagreement becomes visible — and fixable.
   */
  const isBlocked = permission?.granted === false && (isEnabled || wasRefused);

  const toggle = async (next: boolean) => {
    if (!next) {
      setWasRefused(false);
      await setEnabled.run(false);
      return;
    }

    /* Asked on the first switch-on rather than at launch, when the reason for
       it is on screen. Once refused, the OS stops showing the prompt and this
       resolves straight away with `granted: false`. */
    const result = permission?.granted === true ? permission : await request();
    if (!result.granted) {
      setWasRefused(true);
      return;
    }
    setWasRefused(false);
    await setEnabled.run(true);
  };

  const saveTime = (date: Date) => {
    void setTime.run({ hour: date.getHours(), minute: date.getMinutes() });
  };

  const failure = setEnabled.errorMessage ?? setTime.errorMessage;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Reminders
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <SectionHeader label="Daily reminder" />
          <View className="rounded-3xl bg-surface">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Icon icon={BellRing} color={isEnabled ? 'accent' : 'muted'} size={18} />
              <View className="flex-1 gap-0.5">
                <Typography type="body-sm" weight="semibold">
                  Remind me to log
                </Typography>
                <Typography type="body-xs" color="muted">
                  Once a day — skipped on days you’ve already added something.
                </Typography>
              </View>
              <Switch
                isSelected={isEnabled}
                isDisabled={settings.data === undefined || setEnabled.isPending}
                onSelectedChange={(next) => void toggle(next)}
                accessibilityLabel="Daily reminder to log expenses"
              />
            </View>

            {isEnabled && time !== undefined && (
              <View className="flex-row items-center gap-3 border-t border-border px-4 py-3.5">
                <Icon icon={Clock} color="muted" size={18} />
                <Typography type="body-sm" weight="semibold" className="flex-1">
                  Time
                </Typography>
                {/* iOS draws the picker inline and reports every turn of the
                    wheel, so it stays mounted as the compact control. Android
                    opens a dialog on mount that reports once, so it is mounted
                    on press and removed when it answers — the pattern the
                    expense form's date uses. */}
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={dateAt(time)}
                    mode="time"
                    display="compact"
                    accentColor={accentColor}
                    onValueChange={(_event, date) => saveTime(date)}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reminder time, ${formatReminderTime(time)}. Change`}
                    hitSlop={8}
                    onPress={() => setIsPickerOpen(true)}
                    className="rounded-full bg-surface-secondary px-3 py-1.5 active:opacity-60">
                    <Typography type="body-sm" weight="medium">
                      {formatReminderTime(time)}
                    </Typography>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {Platform.OS !== 'ios' && isPickerOpen && time !== undefined && (
            <DateTimePicker
              value={dateAt(time)}
              mode="time"
              is24Hour
              accentColor={accentColor}
              onValueChange={(_event, date) => {
                setIsPickerOpen(false);
                saveTime(date);
              }}
              onDismiss={() => setIsPickerOpen(false)}
            />
          )}

          {isBlocked && (
            <View className="gap-3 rounded-3xl bg-surface p-4">
              <View className="flex-row items-start gap-3">
                <Icon icon={BellOff} color="warning" size={16} />
                <Typography type="body-xs" color="muted" className="flex-1">
                  Notifications are turned off for Finly, so no reminder can be shown. Allow them in
                  your phone’s settings, then come back here.
                </Typography>
              </View>
              <Button
                label="Open settings"
                size="sm"
                tone="secondary"
                onPress={() => void Linking.openSettings()}
              />
            </View>
          )}

          {failure !== null && (
            <Typography type="body-xs" className="px-1 text-danger">
              {failure}
            </Typography>
          )}

          <Typography type="body-xs" color="muted" className="px-1">
            {`Scheduled on this phone, with nothing sent anywhere. Finly lines up the next ${REMINDER_DAYS} days each time you open it, so if it goes unopened for that long the reminders stop until you come back.`}
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
