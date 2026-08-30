import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import {
  ArrowLeft,
  DatabaseBackup,
  FileJson,
  FileSpreadsheet,
  TriangleAlert,
  Upload,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { useDbQuery, type TableName } from '@/db/live';
import { listAccounts } from '@/db/repositories/accounts';
import { listCategories } from '@/db/repositories/categories';
import { listRules } from '@/db/repositories/rules';
import { countExpenses } from '@/db/repositories/expenses';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { formatDayLabel } from '@/domain/period';
import {
  buildBackup,
  restoreBackup,
  validateBackup,
} from '@/features/data-transfer/backup';
import { buildExpensesCsv } from '@/features/data-transfer/csv-export';
import { pickBackupFile, shareText, stampedName } from '@/features/data-transfer/files';

const COUNT_TABLES: readonly TableName[] = ['expenses'];

/** After this long without an export, the warning stops being reassuring. */
const STALE_AFTER_MS = 14 * 86_400_000;

export default function DataTransferScreen() {
  const [notice, setNotice] = useState<string | null>(null);

  const lastExportAt = useDbQuery('data:last-export', ['settings'], (database) => {
    const raw = getSetting('last_export_at', database);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  });

  const expenseCount = useDbQuery('data:expense-count', COUNT_TABLES, (database) =>
    countExpenses({}, database),
  );
  const accountCount = useDbQuery('data:account-count', ['accounts'], (database) =>
    listAccounts({ includeArchived: true }, database).length,
  );
  const catalogue = useDbQuery(
    'data:catalogue-counts',
    ['categories', 'rules'],
    (database) => ({
      categories: listCategories({ includeArchived: true }, database).length,
      rules: listRules(database).length,
    }),
  );

  /* Every count here has to be real. "Covers 0 expenses" next to a Backup
     button is an actively dangerous thing to show when the read simply failed. */
  const counts = [
    [expenseCount.data, 'expense', 'expenses'],
    [accountCount.data, 'account', 'accounts'],
    [catalogue.data?.categories, 'category', 'categories'],
    [catalogue.data?.rules, 'rule', 'rules'],
  ] as const;

  const isCountable = counts.every(([value]) => value !== undefined);
  const contents = counts
    .map(([value, one, many]) => `${value} ${value === 1 ? one : many}`)
    .join(' · ');

  const exportedAt = lastExportAt.data ?? null;
  const isStale = exportedAt === null || Date.now() - exportedAt > STALE_AFTER_MS;

  const markExported = () => {
    setSetting('last_export_at', String(Date.now()));
    lastExportAt.refetch();
  };

  const exportBackup = useAction(async () => {
    const result = await shareText(
      stampedName('finly-backup', 'json'),
      JSON.stringify(buildBackup(), null, 2),
      'application/json',
    );
    markExported();
    setNotice(result.shared ? 'Backup saved.' : `Sharing is unavailable. Saved to ${result.uri}`);
  });

  const exportCsv = useAction(async () => {
    const result = await shareText(
      stampedName('finly-expenses', 'csv'),
      buildExpensesCsv(),
      'text/csv',
    );
    markExported();
    setNotice(result.shared ? 'Expenses exported.' : `Sharing is unavailable. Saved to ${result.uri}`);
  });

  const restore = useAction(async () => {
    const picked = await pickBackupFile();
    if (picked === null) return null;

    const backup = validateBackup(JSON.parse(picked.content) as unknown);
    const summary = await restoreBackup(backup);
    setNotice(
      `Restored ${summary.expenses} expenses, ${summary.accounts} accounts and ${summary.rules} rules.`,
    );
    return summary;
  });

  const confirmRestore = () => {
    Alert.alert(
      'Replace everything on this device?',
      'A restore removes what is here now and puts the backup in its place. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose a backup', style: 'destructive', onPress: () => void restore.run() },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Import & export
        </Typography>
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        {/* The one risk with no server behind it: §10 puts device loss first. */}
        <View className="flex-row items-start gap-3 rounded-3xl bg-surface p-4">
          <Icon icon={TriangleAlert} color="warning" size={16} />
          <View className="flex-1 gap-1">
            <Typography type="body-sm" weight="semibold">
              {exportedAt === null
                ? 'No backup yet'
                : isStale
                  ? 'Your backup is getting old'
                  : 'Backed up'}
            </Typography>
            <Typography type="body-xs" color="muted">
              Everything lives on this device and nowhere else. If you lose the phone, an export
              is the only thing that brings it back.
            </Typography>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader
            label="Export"
            trailing={
              <Typography type="body-sm" color="muted">
                {exportedAt === null ? 'Never exported' : formatDayLabel(exportedAt)}
              </Typography>
            }
          />

          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={FileJson}
              iconTone="accent"
              label="Full backup (JSON)"
              description="Everything, and it restores completely"
              onPress={() => void exportBackup.run()}
            />
            <SettingsRow
              isFirst={false}
              icon={FileSpreadsheet}
              iconTone="iris"
              label="Expenses (CSV)"
              description="Opens in any spreadsheet — expenses only"
              onPress={() => void exportCsv.run()}
            />
          </View>

          <Typography type="body-xs" color="muted" className="px-1">
            {isCountable ? `Covers ${contents}.` : 'Counting what this covers…'}
          </Typography>

          {notice !== null && (
            <Typography type="body-xs" className="px-1 text-accent">
              {notice}
            </Typography>
          )}

          {(exportBackup.errorMessage ?? exportCsv.errorMessage ?? restore.errorMessage) !==
            null && (
            <Typography type="body-xs" className="px-1 text-danger">
              {exportBackup.errorMessage ?? exportCsv.errorMessage ?? restore.errorMessage}
            </Typography>
          )}
        </View>

        {/* §10 promises a backup that "restores fully"; until now there was
            nowhere in the app to restore one. */}
        <View className="gap-3">
          <SectionHeader label="Restore" />

          <View className="rounded-3xl bg-surface">
            <SettingsRow
              isFirst
              icon={DatabaseBackup}
              iconTone="warning"
              label="Restore from a backup"
              description="Replaces everything on this device"
              onPress={confirmRestore}
            />
          </View>

          <Typography type="body-xs" color="muted" className="px-1">
            A restore puts the backup in place of what is here now, soft-deleted rows included, so
            the device ends up exactly as it was when the backup was written.
          </Typography>
        </View>

        <View className="gap-3">
          <SectionHeader label="Import" />

          <View className="gap-3 rounded-3xl bg-surface p-4">
            <View className="flex-row items-center gap-3">
              <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                <Icon icon={Upload} color="foreground" size={16} />
              </View>
              <View className="flex-1 gap-0.5">
                <Typography type="body-sm" weight="semibold">
                  Import from CSV
                </Typography>
                <Typography type="body-xs" color="muted">
                  Bring the spreadsheet across, a column at a time
                </Typography>
              </View>
            </View>

            <Typography type="body-xs" color="muted">
              You pick the file, say which column is which, and see exactly what will be created
              before anything is written. Nothing already recorded is touched.
            </Typography>

            <Button
              tone="secondary"
              label="Start an import"
              onPress={() => router.push('/settings/import')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
