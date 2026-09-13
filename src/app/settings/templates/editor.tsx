import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { NotFound } from '@/components/not-found';
import { TemplateEditor, type TemplateSample } from '@/components/template-editor';
import { useCandidate } from '@/features/capture/hooks';

/**
 * Teaching a format (D18). Opened from a candidate with `?candidateId=`, the
 * candidate's own message is the example — passed by id, never in the URL,
 * because it is multi-line and carries the sender the format is bound to.
 * Opened with no id, the user pastes an example.
 *
 * Every hook sits above every return: the candidate is a query that flips
 * from undefined to a row between renders.
 */
export default function TemplateEditorScreen() {
  const { candidateId } = useLocalSearchParams<{ candidateId?: string }>();
  const candidate = useCandidate(candidateId ?? '');

  const detail = candidate.data;
  const sample = useMemo<TemplateSample | null>(
    () =>
      detail == null
        ? null
        : {
            body: detail.body,
            sender: detail.sender,
            title: detail.title,
            packageName: detail.packageName,
            receivedAt: detail.receivedAt,
          },
    [detail],
  );

  if (candidateId === undefined || candidateId === '') {
    return <TemplateEditor sample={null} onClose={() => router.back()} />;
  }
  if (candidate.error !== null) {
    return <NotFound title="Can't open this message" description={candidate.error.message} />;
  }
  if (detail === null) {
    return <NotFound title="Message gone" description="It has been removed from the inbox. Paste it instead." />;
  }
  if (detail === undefined || sample === null) return null;

  return <TemplateEditor sample={sample} onClose={() => router.back()} />;
}
