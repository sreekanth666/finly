import { router } from 'expo-router';
import { Input, Typography } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/form-screen';
import { useSubmitOnce } from '@/db/use-action';
import { usePasteMessage } from '@/features/capture/hooks';

/**
 * Reading a payment message the user copied (D17). Needs no permission at all,
 * which makes it the fallback for everything the notification listener cannot
 * do: iOS, a notification Android redacted, a message that arrived before
 * detection was switched on.
 */
export default function PasteMessageScreen() {
  const [text, setText] = useState('');
  const paste = usePasteMessage();

  const readOnce = useSubmitOnce(async (body: string) => {
    const outcome = await paste.run(body);
    if (!outcome.ok || outcome.value === null) return false;
    /* Replace rather than push, so closing the candidate returns to the inbox
       instead of to a paste box that has already done its job. */
    router.replace(`/inbox/${outcome.value.candidateId}`);
    return true;
  });

  const canRead = text.trim().length > 0 && !paste.isPending;

  return (
    <FormScreen
      title="Paste a message"
      closeIcon={X}
      closeLabel="Close"
      onClose={() => router.back()}
      contentContainerClassName="gap-4 px-5 pb-6 pt-2"
      footer={
        <>
          {paste.errorMessage !== null && (
            <Typography type="body-xs" className="text-danger">
              {paste.errorMessage}
            </Typography>
          )}
          <Button
            label={paste.isPending ? 'Reading…' : 'Read it'}
            isDisabled={!canRead}
            onPress={() => void readOnce.submit(text)}
          />
        </>
      }>
      <Typography type="body-sm" color="muted">
        Copy a payment message from your bank, card or UPI app and paste it here. It is read on this phone and waits
        in the inbox for you to confirm. Nothing is sent anywhere.
      </Typography>
      <View>
        <Input
          placeholder="ICICI Bank Acct XX316 debited for Rs 720.00 on 02-Sep-26; …"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={8}
          autoFocus
          accessibilityLabel="Payment message"
        />
      </View>
    </FormScreen>
  );
}
