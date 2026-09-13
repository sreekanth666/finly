/**
 * Every email to the developer goes out this one way (D19).
 *
 * The mail composer opens the user's own mail app with the recipient, subject
 * and body filled in and the report attached. The user reads it there and
 * presses send, or doesn't. Finly itself sends nothing and has no network
 * code; the policy promise holds because the last step is always theirs.
 *
 * Three things the composer does that this has to handle:
 *
 * - Its package crashes at import on a build without the native module, so it
 *   is reached through `requireOptionalNativeModule`. The JavaScript wrapper
 *   only forwards to native, so nothing is lost.
 * - It only attaches files it can share through its FileProvider, which covers
 *   the app's files and cache folders. The report goes in the cache.
 * - On Android it always reports "sent" as soon as the user comes back, sent
 *   or not. Callers must never tell the user it was sent.
 *
 * Fallbacks, in order: the composer; a mailto link (no attachment, so the
 * report is appended to the body, if it fits); the Share sheet.
 */

import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import type { MailComposerOptions, MailComposerResult } from 'expo-mail-composer';
import { Linking, Share } from 'react-native';

import { DEVELOPER_EMAIL, mailtoUrl } from '@/domain/txn-detect';

type MailComposer = {
  isAvailableAsync(): Promise<boolean>;
  composeAsync(options: MailComposerOptions): Promise<MailComposerResult>;
};

const composer = requireOptionalNativeModule<MailComposer>('ExpoMailComposer');

export type Outgoing = {
  subject: string;
  body: string;
  attachment?: { name: string; text: string } | null;
};

/**
 * - `composer`: the mail app opened with everything filled in.
 * - `mailto`: the mail app opened from a link, without an attachment.
 * - `shared`: the Share sheet opened; the user picks where it goes.
 * - `failed`: nothing could be opened.
 */
export type SendRoute = 'composer' | 'mailto' | 'shared' | 'failed';

function writeAttachment(attachment: { name: string; text: string }): string | null {
  try {
    const file = new File(Paths.cache, attachment.name);
    if (file.exists) file.delete();
    file.create();
    file.write(attachment.text);
    return file.uri;
  } catch {
    return null;
  }
}

export async function sendToDeveloper(outgoing: Outgoing): Promise<SendRoute> {
  const attachment = outgoing.attachment ?? null;
  const fullText = attachment === null ? outgoing.body : `${outgoing.body}\n\n${attachment.text}`;

  if (composer !== null) {
    try {
      if (await composer.isAvailableAsync()) {
        const uri = attachment === null ? null : writeAttachment(attachment);
        /* Not awaited: on Android it settles only when the user comes back. */
        void composer
          .composeAsync({
            recipients: [DEVELOPER_EMAIL],
            subject: outgoing.subject,
            /* An attachment that could not be written travels in the body instead. */
            body: attachment !== null && uri === null ? fullText : outgoing.body,
            attachments: uri === null ? [] : [uri],
          })
          .catch(() => undefined);
        return 'composer';
      }
    } catch {
      // No mail app took it. The link and the Share sheet are next.
    }
  }

  const url = mailtoUrl(outgoing.subject, fullText);
  if (url !== null) {
    try {
      await Linking.openURL(url);
      return 'mailto';
    } catch {
      // Nothing handles mailto: links on this phone.
    }
  }

  try {
    await Share.share({ title: outgoing.subject, message: `To: ${DEVELOPER_EMAIL}\n${outgoing.subject}\n\n${fullText}` });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** What to tell the user afterwards. Never "sent": Finly cannot know. */
export function sentMessage(route: SendRoute): string {
  switch (route) {
    case 'composer':
    case 'mailto':
      return 'Your mail app is open. Nothing is sent until you press send there.';
    case 'shared':
      return `Choose your mail app, and send it to ${DEVELOPER_EMAIL}.`;
    case 'failed':
      return `No mail app could be opened. You can write to ${DEVELOPER_EMAIL} from any device.`;
  }
}
