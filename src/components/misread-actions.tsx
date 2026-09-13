import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';
import { TemplateShare } from './template-share';

import { maskMessage } from '@/domain/txn-detect';

export type MisreadActionsProps = {
  candidateId: string;
  body: string;
  sender: string | null;
};

/**
 * What to do when Finly read an alert wrong (D18). Teaching the format fixes
 * it on this phone, for this sender, from now on. Sending it to the developer
 * fixes it for everyone, in a later update. Either works without the other.
 */
export function MisreadActions({ candidateId, body, sender }: MisreadActionsProps) {
  const [masked] = useState(() => maskMessage(body));

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Read this wrong? Teach Finly this format"
        onPress={() => router.push({ pathname: '/settings/templates/editor', params: { candidateId } })}
        className="flex-row items-center gap-2 self-start active:opacity-60">
        <Icon icon={GraduationCap} color="link" size={14} />
        <Typography type="body-xs" className="text-link">
          Read this wrong? Teach Finly this format
        </Typography>
      </Pressable>
      <TemplateShare
        maskedMessage={masked}
        template={null}
        sender={sender}
        collapsedLabel="Or send it to the developer, masked"
      />
    </View>
  );
}
