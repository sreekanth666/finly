/**
 * Taught message formats (D18), live: the list, saving one, and what a draft
 * would read before it is saved.
 *
 * Every write is followed by a re-read of pending candidates, so the alert a
 * format was taught from, and anything else waiting from that sender, is read
 * again at once — and deleting a format puts its readings back.
 */

import Constants from 'expo-constants';
import { Linking, Share } from 'react-native';

import { useDbQuery } from '@/db/live';
import { listRecentMessages, type RawCapture } from '@/db/repositories/captures';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  restoreTemplate,
  setTemplateEnabled,
  softDeleteTemplate,
  toSpec,
  type TemplateInput,
  type TemplateListItem,
} from '@/db/repositories/templates';
import { useAction } from '@/db/use-action';
import {
  bindingApplies,
  bindingOf,
  compileTemplate,
  contributionBody,
  contributionSubject,
  detect,
  DEVELOPER_EMAIL,
  mailtoUrl,
  PARSER_VERSION,
  templateIdOf,
  type Detection,
  type TemplateSpec,
} from '@/domain/txn-detect';

import { reparseIfStale } from './ingest';

export function useTemplates() {
  return useDbQuery<TemplateListItem[]>('templates', ['capture_templates'], (database) => listTemplates(database));
}

export function useTemplate(id: string) {
  return useDbQuery<TemplateListItem | null>(`template:${id}`, ['capture_templates'], (database) =>
    getTemplate(id, database),
  );
}

/** Recent messages, for the editor's preview. */
export function useRecentMessages() {
  return useDbQuery<RawCapture[]>('capture:recent', ['captured_messages'], (database) =>
    listRecentMessages(200, database),
  );
}

const thenReparse = <T>(value: T): T => {
  void reparseIfStale();
  return value;
};

export function useCreateTemplate() {
  return useAction((input: TemplateInput) => thenReparse(createTemplate(input)));
}

export function useSetTemplateEnabled() {
  return useAction((id: string, isEnabled: boolean) => thenReparse(setTemplateEnabled(id, isEnabled)));
}

export function useDeleteTemplate() {
  return useAction((id: string) => thenReparse(softDeleteTemplate(id)));
}

export function useRestoreTemplate() {
  return useAction((id: string) => thenReparse(restoreTemplate(id)));
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                      */
/* -------------------------------------------------------------------------- */

export type PreviewRow = {
  key: string;
  body: string;
  /** What the draft would read, or null when the message is not this format. */
  reading: Detection | null;
};

/** How many of a sender's recent messages the preview shows. */
const PREVIEW_ROWS = 8;

/**
 * What a draft template would read from recent messages from the same sender
 * — the ones it would claim, and the ones it would leave alone. An OTP from
 * that sender showing up as read is how a too-broad template shows itself
 * before it is saved. Pure: nothing is written.
 */
export function previewTemplate(spec: TemplateSpec, messages: readonly RawCapture[], exclude: string): PreviewRow[] {
  const compiled = compileTemplate(spec);
  if (compiled === null) return [];
  return messages
    .filter((message) => message.body !== exclude && bindingApplies(spec.binding, bindingOf(message)))
    .slice(0, PREVIEW_ROWS)
    .map((message, index) => {
      const reading = detect(message, { templates: [compiled] });
      return {
        key: `${message.receivedAt}:${index}`,
        body: message.body,
        reading: templateIdOf(reading.reasons) === spec.id ? reading : null,
      };
    });
}

/* -------------------------------------------------------------------------- */
/* Contribution                                                                 */
/* -------------------------------------------------------------------------- */

export const appVersion = (): string | null => Constants.expoConfig?.version ?? null;

export { toSpec };

export function buildContribution(input: { maskedMessage: string; template: TemplateSpec | null; sender: string | null }) {
  return {
    subject: contributionSubject(input.template, input.sender),
    body: contributionBody({
      maskedMessage: input.maskedMessage,
      template: input.template,
      appVersion: appVersion(),
      parserVersion: PARSER_VERSION,
    }),
  };
}

/**
 * Opens the user's mail app with the email written, addressed to the
 * developer. Nothing is sent until they press send. A mail app that cannot be
 * opened, or a body too long to trust to a mailto link, falls back to the
 * Share sheet with the same text.
 */
export async function emailDeveloper(subject: string, body: string): Promise<void> {
  const url = mailtoUrl(subject, body);
  if (url !== null) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // No mail app took the link. The Share sheet always opens.
    }
  }
  await Share.share({ title: subject, message: `To: ${DEVELOPER_EMAIL}\n${subject}\n\n${body}` }).catch(() => undefined);
}

export async function shareContribution(subject: string, body: string): Promise<void> {
  await Share.share({ title: subject, message: `${subject}\n\n${body}` }).catch(() => undefined);
}
