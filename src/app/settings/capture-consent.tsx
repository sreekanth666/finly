import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { Ban, Eye, HardDrive, Trash2, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { Icon } from '@/components/icon';
import { useSubmitOnce } from '@/db/use-action';
import { useAcceptDisclosure, useSetCaptureEnabled } from '@/features/capture/hooks';
import { captureNative } from '@/features/capture/native';

function Point({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <View className="flex-row gap-3 rounded-2xl bg-surface px-4 py-3.5">
      <View className="pt-0.5">
        <Icon icon={icon} color="accent" size={18} />
      </View>
      <View className="flex-1 gap-1">
        <Typography type="body-sm" weight="semibold">
          {title}
        </Typography>
        <Typography type="body-xs" color="muted">
          {body}
        </Typography>
      </View>
    </View>
  );
}

/**
 * The prominent disclosure Google Play requires before an app asks for
 * notification access (D17): what is read, what is kept, where it goes, and how
 * to undo it — shown in the app, before the system screen, with a real choice.
 * Agreeing is the only thing that switches detection on.
 */
export default function CaptureConsentScreen() {
  const accept = useAcceptDisclosure();
  const enable = useSetCaptureEnabled();

  const agreeOnce = useSubmitOnce(async () => {
    const accepted = await accept.run();
    if (!accepted.ok) return false;
    const enabled = await enable.run(true);
    if (!enabled.ok) return false;
    router.back();
    /* The sync pushes the flag to the listener; the system screen is where the
       grant itself happens, and it needs the component already switched on. */
    try {
      captureNative?.setEnabled(true);
      if (captureNative?.isGranted() === false) captureNative.openListenerSettings();
    } catch {
      // The settings screen offers the same button if this did not open.
    }
    return true;
  });

  const errorMessage = accept.errorMessage ?? enable.errorMessage;

  return (
    <FormScreen
      title="Before you turn this on"
      closeIcon={X}
      closeLabel="Close"
      onClose={() => router.back()}
      contentContainerClassName="gap-3 px-5 pb-6 pt-2"
      footer={
        <>
          {errorMessage !== null && (
            <Typography type="body-xs" className="text-danger">
              {errorMessage}
            </Typography>
          )}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Not now" tone="secondary" onPress={() => router.back()} />
            </View>
            <View className="flex-1">
              <Button label="Agree and continue" onPress={() => void agreeOnce.submit()} />
            </View>
          </View>
        </>
      }>
      <Typography type="body-sm" color="muted" className="pb-2">
        Finly can fill in expenses from the payment alerts your bank, card and UPI apps send you. To do that it needs
        Android’s notification access, which you grant on the next screen.
      </Typography>

      <Point
        icon={Eye}
        title="What Finly reads"
        body="Notifications from your SMS app and from the payment apps you choose. Nothing from any other app is read or recorded."
      />
      <Point
        icon={HardDrive}
        title="What Finly keeps"
        body="Only messages that look like a payment — an amount and a word like debited, spent or credited. Anything else is discarded on the spot, before it is stored. What is kept stays on this phone."
      />
      <Point
        icon={Ban}
        title="What Finly never does"
        body="It never uploads, shares or sends your messages anywhere — Finly has no servers and no network code. It never adds an expense without you confirming it, and it does not ask to read your SMS inbox."
      />
      <Point
        icon={Trash2}
        title="How to undo it"
        body="Switch detection off in Settings to stop all reading and clear anything waiting. Reviewed messages are deleted after the retention period you choose. You can withdraw notification access in Android’s settings at any time."
      />
    </FormScreen>
  );
}
