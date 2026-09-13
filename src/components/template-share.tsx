import { Input, Typography } from 'heroui-native';
import { Mail, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from './button';

import type { TemplateSpec } from '@/domain/txn-detect';
import { buildContribution, emailDeveloper, shareContribution } from '@/features/capture/templates';

export type TemplateShareProps = {
  /** Already masked — see `maskMessage`. */
  maskedMessage: string;
  /** The taught format, when there is one; null for a plain "this was misread". */
  template: TemplateSpec | null;
  /** For the subject line. */
  sender: string | null;
  /** The link shown while closed. */
  collapsedLabel?: string;
  initiallyOpen?: boolean;
};

/**
 * Sending a misread message, or a format the user taught, to the developer
 * (D18) — so the next update reads it for everyone.
 *
 * The email is written here and shown in full, editable, before anything
 * leaves: reference numbers, card digits and UPI ids are already scrambled,
 * but a payee's name cannot be told from a merchant's, and only the person
 * sending can judge what else to take out. "Email the developer" opens their
 * own mail app, addressed and filled in; they press send, or don't. Finly
 * itself sends nothing.
 */
export function TemplateShare({
  maskedMessage,
  template,
  sender,
  collapsedLabel = 'Read this wrong? Send it to the developer, masked',
  initiallyOpen = false,
}: TemplateShareProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [draft] = useState(() => buildContribution({ maskedMessage, template, sender }));
  const [body, setBody] = useState(draft.body);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setIsOpen(true)} className="self-start active:opacity-60">
        <Typography type="body-xs" className="text-link">
          {collapsedLabel}
        </Typography>
      </Pressable>
    );
  }

  const send = async (how: 'email' | 'share') => {
    setIsSending(true);
    try {
      if (how === 'email') await emailDeveloper(draft.subject, body);
      else await shareContribution(draft.subject, body);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View className="gap-2 rounded-2xl bg-surface p-3">
      <Typography type="body-xs" color="muted">
        Reference numbers, card digits and UPI ids are scrambled. Remove anything else you would rather not send, such
        as a person’s name. Nothing is sent until you send it from your mail app.
      </Typography>
      <Input value={body} onChangeText={setBody} multiline numberOfLines={8} accessibilityLabel="Email to the developer" />
      <Button
        icon={Mail}
        label="Email the developer"
        isDisabled={isSending || body.trim().length === 0}
        onPress={() => void send('email')}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Not now" tone="secondary" size="sm" onPress={() => setIsOpen(false)} />
        </View>
        <View className="flex-1">
          <Button
            icon={Share2}
            label="Share instead"
            tone="secondary"
            size="sm"
            isDisabled={isSending || body.trim().length === 0}
            onPress={() => void send('share')}
          />
        </View>
      </View>
    </View>
  );
}
