/**
 * Getting files in and out of the app.
 *
 * Sharing rather than saving: on both platforms an app cannot write into the
 * user's own storage directly, so a file is written to the cache and handed to
 * the system share sheet, from which the user puts it wherever they keep things.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type PickedFile = { name: string; content: string };

/**
 * Android routinely reports a CSV as `application/octet-stream` or
 * `text/plain`, so the filter has to include a wildcard or the file the user
 * wants is greyed out. What it actually is gets decided by parsing it.
 */
const CSV_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'text/plain',
  '*/*',
];

const JSON_TYPES = ['application/json', 'text/plain', '*/*'];

async function pick(types: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset === undefined) return null;

  return { name: asset.name, content: new File(asset.uri).textSync() };
}

export const pickCsvFile = (): Promise<PickedFile | null> => pick(CSV_TYPES);
export const pickBackupFile = (): Promise<PickedFile | null> => pick(JSON_TYPES);

export type ShareResult = { uri: string; shared: boolean };

/**
 * Writes to the cache directory and offers the share sheet.
 *
 * Returns the path even when sharing is unavailable, so the screen can tell the
 * user where the file is rather than leaving them with a silent failure.
 */
export async function shareText(
  filename: string,
  contents: string,
  mimeType: string,
): Promise<ShareResult> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (!(await Sharing.isAvailableAsync())) {
    return { uri: file.uri, shared: false };
  }

  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  return { uri: file.uri, shared: true };
}

/** `finly-backup-2026-08-30`, in local time. */
export function stampedName(prefix: string, extension: string, now: number = Date.now()): string {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${extension}`;
}
