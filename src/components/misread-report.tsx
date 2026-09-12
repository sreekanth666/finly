import { Input, Typography } from 'heroui-native';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { Button } from './button';

import { maskMessage } from '@/domain/txn-detect';

export type MisreadReportProps = {
  /** The message as it arrived. */
  body: string;
};

/**
 * "This was read wrong" (D17) — the only way the detector learns about a bank
 * format it has never seen, without anyone's messages leaving the phone on
 * their own.
 *
 * The message is masked first (references, tails and UPI ids scrambled, the
 * greeting name removed) and shown in an editable box, because a payee's name
 * cannot be told from a merchant's and only the person can judge what else to
 * remove. Nothing is sent: the system share sheet asks where it goes.
 */
export function MisreadReport({ body }: MisreadReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(() => maskMessage(body));

  if (!isOpen) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        className="self-start active:opacity-60">
        <Typography type="body-xs" className="text-link">
          Read this wrong? Share it, masked, to help fix it
        </Typography>
      </Pressable>
    );
  }

  return (
    <View className="gap-2 rounded-2xl bg-surface p-3">
      <Typography type="body-xs" color="muted">
        Reference numbers, card digits and UPI ids have been scrambled. Remove anything else you would rather not
        share, such as a person’s name, before sending.
      </Typography>
      <Input value={text} onChangeText={setText} multiline numberOfLines={6} accessibilityLabel="Masked message" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Cancel" tone="secondary" size="sm" onPress={() => setIsOpen(false)} />
        </View>
        <View className="flex-1">
          <Button
            icon={Share2}
            label="Share"
            size="sm"
            isDisabled={text.trim().length === 0}
            onPress={() => {
              void Share.share({ message: text }).catch(() => undefined);
            }}
          />
        </View>
      </View>
    </View>
  );
}
