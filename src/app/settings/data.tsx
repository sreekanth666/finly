import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, FileJson, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { SettingsRow } from '@/components/settings-row';
import { accounts } from '@/data/accounts';
import { CATEGORIES } from '@/data/categories';
import { rules } from '@/data/rules';
import { settlements } from '@/data/settlements';
import { transactionDays } from '@/data/transactions';

type ExportFormat = 'json' | 'csv';

export default function DataTransferScreen() {
  /* Nothing is written in the design pass, but the rows have to behave like
     actions — an inert row with no chevron reads as a label, and the "Never
     exported" line could otherwise never change. */
  const [lastExport, setLastExport] = useState<ExportFormat | null>(null);
  const expenseCount = transactionDays.reduce((total, day) => total + day.transactions.length, 0);

  const contents = [
    `${expenseCount} expenses`,
    `${settlements.length} settlements`,
    `${accounts.length} accounts`,
    `${Object.keys(CATEGORIES).length} categories`,
    `${rules.length} rules`,
  ].join(' · ');

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
              {lastExport === null ? 'No backup yet' : 'Backed up'}
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
                {lastExport === null ? 'Never exported' : 'Exported just now'}
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
              value={lastExport === 'json' ? 'Just now' : undefined}
              onPress={() => setLastExport('json')}
            />
            <SettingsRow
              isFirst={false}
              icon={FileSpreadsheet}
              iconTone="iris"
              label="Expenses (CSV)"
              description="Opens in any spreadsheet — expenses only"
              value={lastExport === 'csv' ? 'Just now' : undefined}
              onPress={() => setLastExport('csv')}
            />
          </View>

          <Typography type="body-xs" color="muted" className="px-1">
            {`Covers ${contents}.`}
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
