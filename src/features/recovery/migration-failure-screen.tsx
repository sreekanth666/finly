/**
 * What the user sees when the database cannot be opened or migrated.
 *
 * §10 calls a bricked migration a top risk, and the mitigation is not a nicer
 * error message — it is getting the data out. So the first and largest action
 * here hands them the raw database file. Everything else is secondary.
 *
 * Deliberately uses no drizzle, no repositories and no queries: by definition
 * the schema may be unusable, and a recovery screen that itself needs a working
 * database is no recovery screen at all.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { Typography } from 'heroui-native';
import { DatabaseBackup, RotateCw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { DATABASE_NAME } from '@/db/client';

type ExportState = 'idle' | 'working' | 'shared' | 'failed';

/**
 * expo-sqlite keeps databases in a SQLite/ subdirectory of the document
 * directory. Reaching for the file directly is the only option here — the
 * connection that would normally serve a backup is the thing that failed.
 */
const databaseFile = () => new File(Paths.document, 'SQLite', DATABASE_NAME);

async function exportRawDatabase(): Promise<void> {
  /*
   * In WAL mode the most recent writes live in the -wal sidecar, not the .db
   * file. Copying the .db alone would silently hand the user a backup missing
   * exactly the data they are trying to rescue, so checkpoint it back first.
   * The connection may be unusable, hence the throwaway open and the catch.
   */
  try {
    const raw = SQLite.openDatabaseSync(DATABASE_NAME);
    raw.execSync('PRAGMA wal_checkpoint(TRUNCATE)');
    raw.closeSync();
  } catch {
    // Nothing to checkpoint, or the database is too damaged to open. Either way
    // the file on disk is still the best copy available — carry on and share it.
  }

  const source = databaseFile();
  if (!source.exists) {
    throw new Error('There is no database file on this device to export.');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const destination = new File(Paths.cache, `finly-recovery-${stamp}.db`);
  if (destination.exists) destination.delete();
  source.copy(destination);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`Sharing is unavailable. The file is at ${destination.uri}`);
  }

  await Sharing.shareAsync(destination.uri, {
    mimeType: 'application/x-sqlite3',
    dialogTitle: 'Save your Finly database',
  });
}

export type MigrationFailureScreenProps = {
  error: Error;
  onRetry: () => void;
};

export function MigrationFailureScreen({ error, onRetry }: MigrationFailureScreenProps) {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExportState('working');
    setExportError(null);
    try {
      await exportRawDatabase();
      setExportState('shared');
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
      setExportState('failed');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="grow justify-center gap-6 px-6 py-10">
        <View className="gap-3">
          <Icon icon={TriangleAlert} color="danger" size={32} />
          <Typography type="h2">Finly could not open your data</Typography>
          <Typography type="body-sm" color="muted">
            Nothing has been deleted. The database is still on this device — it just could not be
            prepared for this version of the app. Save a copy before doing anything else.
          </Typography>
        </View>

        <View className="rounded-3xl bg-surface p-4">
          <Typography type="body-xs" color="muted">
            {error.message}
          </Typography>
        </View>

        <View className="gap-3">
          <Button
            label={exportState === 'working' ? 'Preparing…' : 'Save a copy of my data'}
            icon={DatabaseBackup}
            isDisabled={exportState === 'working'}
            onPress={handleExport}
          />
          {exportState === 'shared' ? (
            <Typography type="body-xs" color="muted">
              Saved. Keep that file somewhere safe — it is a complete copy.
            </Typography>
          ) : null}
          {exportError !== null ? (
            <Typography type="body-xs" className="text-danger">
              {exportError}
            </Typography>
          ) : null}

          <Button label="Try again" icon={RotateCw} tone="secondary" onPress={onRetry} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
