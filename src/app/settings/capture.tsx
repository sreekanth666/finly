import { router } from 'expo-router';
import { Switch, Typography } from 'heroui-native';
import {
  ArrowLeft,
  BatteryWarning,
  BellRing,
  ClipboardPaste,
  EyeOff,
  Inbox,
  MessageSquareText,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { FilterChipBar } from '@/components/filter-chip-bar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { formatDayLabel, formatTime } from '@/domain/period';
import { PAYMENT_APPS, RETENTION_CHOICES } from '@/domain/txn-detect';
import {
  useCaptureSettings,
  useClearCaptures,
  useSetCaptureEnabled,
  useSetCaptureNotify,
  useSetCapturePackages,
  useSetRetentionDays,
} from '@/features/capture/hooks';
import {
  captureNative,
  useAppChoices,
  useListenerState,
  useNativeStats,
} from '@/features/capture/native';
import { useNavigateOnce } from '@/features/navigation/hooks';
import { useReminderPermission } from '@/features/reminders/hooks';

const RETENTION_OPTIONS = RETENTION_CHOICES.map((days) => ({
  id: String(days),
  label: days === 365 ? 'A year' : `${days} days`,
}));

const when = (ms: number) => (ms > 0 ? `${formatDayLabel(ms)} ${formatTime(ms)}` : 'Never');

function ToggleRow({
  label,
  description,
  isSelected,
  isDisabled,
  onChange,
  isFirst,
}: {
  label: string;
  description?: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (next: boolean) => void;
  isFirst: boolean;
}) {
  return (
    <View
      className={
        isFirst
          ? 'flex-row items-center gap-3 px-4 py-3.5'
          : 'flex-row items-center gap-3 border-t border-border px-4 py-3.5'
      }>
      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="medium">
          {label}
        </Typography>
        {description !== undefined && (
          <Typography type="body-xs" color="muted">
            {description}
          </Typography>
        )}
      </View>
      <Switch
        isSelected={isSelected}
        isDisabled={isDisabled}
        onSelectedChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Notice({ icon, text, action }: { icon: typeof ShieldAlert; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="gap-3 rounded-3xl bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <Icon icon={icon} color="warning" size={16} />
        <Typography type="body-xs" color="muted" className="flex-1">
          {text}
        </Typography>
      </View>
      {action !== undefined && <Button label={action.label} size="sm" tone="secondary" onPress={action.onPress} />}
    </View>
  );
}

/**
 * Transaction detection (D17): switching it on, the apps it may read, and what
 * it has been doing — so a listener Android has quietly stopped is visible
 * here rather than looking like a quiet week.
 */
export default function CaptureSettingsScreen() {
  const navigate = useNavigateOnce();

  const settings = useCaptureSettings();
  const { state, refresh } = useListenerState();
  const stats = useNativeStats();
  const notificationPermission = useReminderPermission();

  const setEnabled = useSetCaptureEnabled();
  const setPackages = useSetCapturePackages();
  const setNotify = useSetCaptureNotify();
  const setRetention = useSetRetentionDays();
  const clear = useClearCaptures();

  const chosen = settings.data?.packages ?? [];
  const apps = useAppChoices(PAYMENT_APPS, chosen);
  const [onScreen, setOnScreen] = useState<{ packageName: string; label: string }[] | null>(null);

  const isEnabled = settings.data?.enabled ?? false;
  const failure =
    setEnabled.errorMessage ?? setPackages.errorMessage ?? setNotify.errorMessage ?? setRetention.errorMessage ?? clear.errorMessage;

  const toggle = async (next: boolean) => {
    if (!next) {
      await setEnabled.run(false);
      return;
    }
    if (settings.data?.disclosureAcceptedAt == null) {
      navigate('/settings/capture-consent');
      return;
    }
    const outcome = await setEnabled.run(true);
    if (!outcome.ok) return;
    try {
      captureNative?.setEnabled(true);
      if (captureNative?.isGranted() === false) captureNative.openListenerSettings();
    } catch {
      // The notice below offers the same button.
    }
  };

  const toggleApp = (packageName: string, next: boolean) => {
    const updated = next ? [...chosen, packageName] : chosen.filter((name) => name !== packageName);
    void setPackages.run(updated);
  };

  const toggleNotify = async (next: boolean) => {
    if (next && notificationPermission.permission?.granted !== true) {
      const result = await notificationPermission.request();
      if (!result.granted) return;
    }
    await setNotify.run(next);
  };

  const findOnScreen = async () => {
    try {
      const found = (await captureNative?.listActivePackages()) ?? [];
      setOnScreen(found.filter((app) => !chosen.includes(app.packageName)));
    } catch {
      setOnScreen([]);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear the inbox?',
      'Every captured message and everything waiting for review is deleted. Expenses you already confirmed keep their copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void clear.run() },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Transaction detection
        </Typography>
      </View>

      <ScrollView contentContainerClassName="gap-6 px-5 pb-8 pt-4" showsVerticalScrollIndicator={false}>
        <Typography type="body-sm" color="muted">
          Payments read from your bank, card and UPI alerts wait in a review list. Nothing becomes an expense until
          you confirm it, and nothing leaves this phone.
        </Typography>

        <View className="gap-3">
          <SectionHeader label="Notifications" />
          <View className="rounded-3xl bg-surface">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Icon icon={MessageSquareText} color={isEnabled ? 'accent' : 'muted'} size={18} />
              <View className="flex-1 gap-0.5">
                <Typography type="body-sm" weight="semibold">
                  Read payment notifications
                </Typography>
                <Typography type="body-xs" color="muted">
                  {state.available ? 'Your SMS app and the payment apps you pick below' : 'Not available on this phone'}
                </Typography>
              </View>
              <Switch
                isSelected={isEnabled}
                isDisabled={!state.available || settings.data === undefined || setEnabled.isPending}
                onSelectedChange={(next) => void toggle(next)}
                accessibilityLabel="Read payment notifications"
              />
            </View>
          </View>

          {!state.available && (
            <Typography type="body-xs" color="muted" className="px-1">
              Reading notifications needs Android. You can still paste a payment message yourself.
            </Typography>
          )}

          {state.available && isEnabled && !state.granted && (
            <Notice
              icon={ShieldAlert}
              text="Finly does not have notification access yet, so nothing is being read. Allow it on the next screen, then come back."
              action={{ label: 'Allow notification access', onPress: () => captureNative?.openListenerSettings() }}
            />
          )}

          {state.available && isEnabled && state.granted && !state.connected && (
            <Notice
              icon={BatteryWarning}
              text="Android has stopped the listener. Opening Finly usually restarts it. If it keeps stopping, allow Finly to run in the background in your phone's battery settings."
              action={{
                label: 'Restart listener',
                onPress: () => {
                  captureNative?.requestRebind();
                  refresh();
                },
              }}
            />
          )}

          {stats != null && stats.redacted > 0 && (
            <Notice
              icon={EyeOff}
              text={`Android hid ${stats.redacted === 1 ? 'one alert' : `${stats.redacted} alerts`} from Finly because it thought ${stats.redacted === 1 ? 'it' : 'they'} contained a code. Copy those from your SMS app and paste them instead.`}
              action={{ label: 'Paste a message', onPress: () => navigate('/inbox/paste') }}
            />
          )}
        </View>

        {state.available && isEnabled && (
          <View className="gap-3">
            <SectionHeader label="Payment apps" />
            <View className="rounded-3xl bg-surface">
              <ToggleRow
                isFirst
                label="SMS app"
                description="Always read — this is where bank alerts arrive"
                isSelected
                isDisabled
                onChange={() => undefined}
              />
              {(apps ?? []).map((app) => (
                <ToggleRow
                  key={app.packageName}
                  isFirst={false}
                  label={app.label}
                  description={app.isCurated ? undefined : app.packageName}
                  isSelected={chosen.includes(app.packageName)}
                  onChange={(next) => toggleApp(app.packageName, next)}
                />
              ))}
            </View>

            {onScreen === null ? (
              <Button
                icon={Plus}
                label="Add an app from your notifications"
                tone="secondary"
                size="sm"
                isDisabled={!state.connected}
                onPress={() => void findOnScreen()}
              />
            ) : (
              <View className="gap-2 rounded-3xl bg-surface p-3">
                <Typography type="body-xs" color="muted" className="px-1">
                  {onScreen.length === 0
                    ? 'No other app has a notification showing right now. Wait for a payment alert from it, then try again.'
                    : 'Apps with a notification showing now. Pick the one your payment alert came from.'}
                </Typography>
                {onScreen.map((app) => (
                  <Pressable
                    key={app.packageName}
                    accessibilityRole="button"
                    accessibilityLabel={`Read notifications from ${app.label}`}
                    onPress={() => {
                      toggleApp(app.packageName, true);
                      setOnScreen(null);
                    }}
                    className="rounded-2xl bg-surface-secondary px-3 py-2.5 active:opacity-60">
                    <Typography type="body-sm" weight="medium">
                      {app.label}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {app.packageName}
                    </Typography>
                  </Pressable>
                ))}
                <Button label="Done" tone="secondary" size="sm" onPress={() => setOnScreen(null)} />
              </View>
            )}
          </View>
        )}

        {state.available && isEnabled && (
          <View className="gap-3">
            <SectionHeader label="While Finly is closed" />
            <View className="rounded-3xl bg-surface">
              <View className="flex-row items-center gap-3 px-4 py-3.5">
                <Icon icon={BellRing} color={settings.data?.notify === true ? 'accent' : 'muted'} size={18} />
                <View className="flex-1 gap-0.5">
                  <Typography type="body-sm" weight="semibold">
                    Tell me when payments arrive
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    A count only — never an amount or a payee
                  </Typography>
                </View>
                <Switch
                  isSelected={settings.data?.notify ?? false}
                  isDisabled={setNotify.isPending}
                  onSelectedChange={(next) => void toggleNotify(next)}
                  accessibilityLabel="Tell me when payments arrive"
                />
              </View>
            </View>
          </View>
        )}

        <View className="gap-3">
          <SectionHeader label="Review" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button icon={Inbox} label="Open inbox" tone="secondary" size="sm" onPress={() => navigate('/inbox')} />
            </View>
            <View className="flex-1">
              <Button
                icon={ClipboardPaste}
                label="Paste a message"
                tone="secondary"
                size="sm"
                onPress={() => navigate('/inbox/paste')}
              />
            </View>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Keep reviewed messages for" />
          <FilterChipBar
            options={RETENTION_OPTIONS}
            selectedId={String(settings.data?.retentionDays ?? 30)}
            onSelect={(id) => void setRetention.run(Number(id))}
          />
          <Typography type="body-xs" color="muted" className="px-1">
            After that, a reviewed message is deleted for good, and so are offers, OTPs and reminders nobody opened.
            Confirmed expenses keep their own copy of the message. Payments still waiting are never cleared by age.
          </Typography>
          <Button icon={Trash2} label="Clear the inbox now" tone="secondary" size="sm" onPress={confirmClear} />
        </View>

        {state.available && (
          <View className="gap-3">
            <SectionHeader label="Status" />
            <View className="gap-1.5 rounded-3xl bg-surface p-4">
              <Typography type="body-xs" color="muted">
                {`Notification access: ${state.granted ? 'allowed' : 'not allowed'}`}
              </Typography>
              <Typography type="body-xs" color="muted">
                {`Listener: ${state.connected ? 'running' : 'not running'}`}
              </Typography>
              {stats != null && (
                <>
                  <Typography type="body-xs" color="muted">
                    {`Last payment alert read: ${when(stats.lastCaptureAt)}`}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {`Last started: ${when(stats.lastConnectedAt)}`}
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    {`Set aside as not payments: ${stats.rejected} · Hidden by Android: ${stats.redacted} · Unreadable: ${stats.unreadable}`}
                  </Typography>
                </>
              )}
              {settings.data !== undefined && (
                <Typography type="body-xs" color="muted">
                  {`Stored now: ${settings.data.stats.messages} messages, ${settings.data.stats.pending} waiting`}
                </Typography>
              )}
            </View>
            <Typography type="body-xs" color="muted" className="px-1">
              On Xiaomi, Oppo, Vivo, OnePlus and Realme phones, battery savers often stop apps that read notifications.
              If detection goes quiet, set Finly’s battery use to Unrestricted in your phone’s app settings.
            </Typography>
          </View>
        )}

        {failure !== null && (
          <Typography type="body-xs" className="px-1 text-danger">
            {failure}
          </Typography>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
