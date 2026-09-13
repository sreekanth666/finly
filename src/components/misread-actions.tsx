import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';
import { TemplateShare } from './template-share';

import type { CandidateDetail } from '@/db/repositories/captures';
import { senderKeyOf } from '@/domain/support/diagnostics';
import { maskMessage, sourceAppName, type ReadingSummary } from '@/domain/txn-detect';

export type MisreadActionsProps = {
  candidate: CandidateDetail;
};

/** What Finly made of a candidate, for the developer: no amount, the payee masked. */
function readingOf(candidate: CandidateDetail): ReadingSummary {
  const key = senderKeyOf(candidate);
  return {
    kind: candidate.kind,
    direction: candidate.direction,
    confidence: candidate.confidence,
    dateConfidence: candidate.dateConfidence,
    reasons: candidate.reasons.map((reason) => (reason.startsWith('template:') ? 'template' : reason)),
    maskedPayee: candidate.counterparty === null ? null : maskMessage(candidate.counterparty),
    sourceApp: sourceAppName(candidate.source, candidate.packageName),
    senderKey: key === sourceAppName(candidate.source, candidate.packageName) ? null : key,
  };
}

/**
 * What to do when Finly read an alert wrong (D18). Teaching the format fixes
 * it on this phone, for this sender, from now on. Sending it to the developer
 * fixes it for everyone, in a later update. Either works without the other.
 */
export function MisreadActions({ candidate }: MisreadActionsProps) {
  const [masked] = useState(() => maskMessage(candidate.body));
  const [reading] = useState(() => readingOf(candidate));

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Read this wrong? Teach Finly this format"
        onPress={() =>
          router.push({ pathname: '/settings/templates/editor', params: { candidateId: candidate.id } })
        }
        className="flex-row items-center gap-2 self-start active:opacity-60">
        <Icon icon={GraduationCap} color="link" size={14} />
        <Typography type="body-xs" className="text-link">
          Read this wrong? Teach Finly this format
        </Typography>
      </Pressable>
      <TemplateShare
        maskedMessage={masked}
        template={null}
        sender={candidate.sender}
        issuer={candidate.issuer}
        reading={reading}
        collapsedLabel="Or send it to the developer, masked"
      />
    </View>
  );
}
