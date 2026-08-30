import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, Fingerprint, KeyRound, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { useDbQuery } from '@/db/live';
import { getFlag, getSetting, setFlag } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { disableEncryption, enableEncryption, isEncrypted } from '@/features/security/encryption';

/** After this long without an export, encrypting is a bad bet. */
const STALE_EXPORT_MS = 7 * 86_400_000;

export default function SecuritySettingsScreen() {
  const [notice, setNotice] = useState<string | null>(null);

  const state = useDbQuery('security:state', ['settings'], (database) => {
    const rawExport = getSetting('last_export_at', database);
    const exportedAt = rawExport === null ? null : Number(rawExport);

    return {
      appLock: getFlag('app_lock_enabled', database),
      encrypted: isEncrypted(),
      hasFreshBackup:
        exportedAt !== null && Number.isFinite(exportedAt) && Date.now() - exportedAt < STALE_EXPORT_MS,
    };
  });

  const toggleLock = useAction((next: boolean) => setFlag('app_lock_enabled', next));
  const encrypt = useAction(enableEncryption);
  const decrypt = useAction(disableEncryption);

  const restartNotice =
    'Done. Close and reopen Finly — the database was replaced, and the app is still holding the old one.';

  const confirmEncrypt = () => {
    Alert.alert(
      'Encrypt this database?',
      state.data?.hasFreshBackup === true
        ? 'The key is kept in the device keychain. If the keychain is ever lost, only your backup can bring the data back.'
        : 'You have no recent backup. The key lives in the device keychain, and if that is lost the data cannot be recovered without one. Export first.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...(state.data?.hasFreshBackup === true
          ? []
          : [
              {
                text: 'Back up first',
                onPress: () => router.push('/settings/data'),
              },
            ]),
        {
          text: 'Encrypt',
          style: 'destructive' as const,
          onPress: async () => {
            const outcome = await encrypt.run();
            if (outcome.ok) setNotice(restartNotice);
            state.refetch();
          },
        },
      ],
    );
  };

  const confirmDecrypt = () => {
    Alert.alert('Remove encryption?', 'The database will be rewritten unencrypted on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const outcome = await decrypt.run();
          if (outcome.ok) setNotice(restartNotice);
          state.refetch();
        },
      },
    ]);
  };

  const busy = encrypt.isPending || decrypt.isPending;
  const failure = encrypt.errorMessage ?? decrypt.errorMessage ?? toggleLock.errorMessage;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Security
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <SectionHeader label="App lock" />
          <View className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-3.5">
            <Icon icon={Fingerprint} color="accent" size={18} />
            <View className="flex-1 gap-0.5">
              <Typography type="body-sm" weight="semibold">
                Require unlock
              </Typography>
              <Typography type="body-xs" color="muted">
                On opening, and on returning after a minute away.
              </Typography>
            </View>
            <Switch
              value={state.data?.appLock ?? false}
              onValueChange={(next) => {
                void toggleLock.run(next).then(() => state.refetch());
              }}
              accessibilityLabel="Require unlock to open Finly"
            />
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader label="Encryption" />
          <View className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-3.5">
            <Icon icon={KeyRound} color={state.data?.encrypted === true ? 'accent' : 'muted'} size={18} />
            <View className="flex-1 gap-0.5">
              <Typography type="body-sm" weight="semibold">
                {state.data?.encrypted === true ? 'Database is encrypted' : 'Encrypt the database'}
              </Typography>
              <Typography type="body-xs" color="muted">
                {busy
                  ? 'Rewriting the database…'
                  : 'Protects your data if the phone is lost or the storage is read directly.'}
              </Typography>
            </View>
            <Switch
              value={state.data?.encrypted ?? false}
              disabled={busy || state.data === undefined}
              onValueChange={(next) => (next ? confirmEncrypt() : confirmDecrypt())}
              accessibilityLabel="Encrypt the database"
            />
          </View>

          {/* §10's device-loss risk cuts both ways once a key is involved, and
              that belongs in front of the user rather than in a doc. */}
          <View className="flex-row items-start gap-3 rounded-3xl bg-surface p-4">
            <Icon icon={TriangleAlert} color="warning" size={16} />
            <Typography type="body-xs" color="muted" className="flex-1">
              The key is held in this device&apos;s keychain, never in the database and never
              anywhere else. If the keychain is lost — some restores, some factory resets — an
              export is the only way back. Keep a recent backup.
            </Typography>
          </View>

          {notice !== null && (
            <Typography type="body-xs" className="px-1 text-accent">
              {notice}
            </Typography>
          )}
          {failure !== null && (
            <Typography type="body-xs" className="px-1 text-danger">
              {failure}
            </Typography>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
