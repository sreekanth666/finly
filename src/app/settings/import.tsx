import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { CircleCheck, FileSpreadsheet, TriangleAlert, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { StepIndicator } from '@/components/step-indicator';
import { pickableFiles, type PickableFile } from '@/data/import-files';
import {
  buildRows,
  guessMapping,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  isMappingComplete,
  parseCsv,
  REQUIRED_FIELDS,
  summarise,
  type ColumnMapping,
  type ImportField,
  type ImportRow,
} from '@/domain/csv';

const STEPS = ['Choose a file', 'Map columns', 'Preview', 'Done'];

const PREVIEW_LIMIT = 6;

/** Spelled out per state so the compiler sees every variant. */
const CHIP = {
  on: 'rounded-full border border-accent bg-accent px-3 py-1.5',
  off: 'rounded-full border border-border bg-default px-3 py-1.5 active:opacity-60',
} as const;

const CHIP_LABEL = { on: 'text-accent-foreground', off: 'text-foreground' } as const;

const ROW = {
  first: 'gap-1 px-4 py-3',
  rest: 'gap-1 border-t border-border px-4 py-3',
} as const;

function PreviewRow({ row, isFirst }: { row: ImportRow; isFirst: boolean }) {
  const hasIssues = row.issues.length > 0;

  return (
    <View className={isFirst ? ROW.first : ROW.rest}>
      <View className="flex-row items-center gap-2">
        <Icon
          icon={hasIssues ? TriangleAlert : CircleCheck}
          color={hasIssues ? 'danger' : 'accent'}
          size={14}
        />
        <Typography type="body-sm" weight="medium" className="flex-1" truncate>
          {row.item.length > 0 ? row.item : '—'}
        </Typography>
        {row.amount === null ? (
          <Typography type="body-sm" className="text-danger">
            {row.rawAmount.length > 0 ? row.rawAmount : '—'}
          </Typography>
        ) : (
          <Amount
            value={row.amount}
            className="type-amount-sm text-foreground"
            centsClassName="type-amount-sm"
          />
        )}
      </View>

      <Typography type="body-xs" color="muted" truncate>
        {[row.date, row.account, row.category, row.note].filter(Boolean).join(' · ') || '—'}
      </Typography>

      {row.issues.map((issue) => (
        <Typography key={issue} type="body-xs" className="text-danger">
          {issue}
        </Typography>
      ))}
    </View>
  );
}

export default function ImportScreen() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<PickableFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);

  const table = useMemo(() => (file ? parseCsv(file.content) : null), [file]);
  const rows = useMemo(
    () => (table && mapping ? buildRows(table, mapping) : []),
    [table, mapping]
  );
  const summary = useMemo(() => summarise(rows), [rows]);

  const choose = (picked: PickableFile) => {
    const parsed = parseCsv(picked.content);

    setFile(picked);
    /* The guess is a starting point, not a decision — step 2 shows it. */
    setMapping(guessMapping(parsed.headers));
    setStep(1);
  };

  const assign = (field: ImportField, column: number | null) =>
    setMapping((current) => {
      if (!current) return current;

      const next = { ...current, [field]: column };

      /* One column can only mean one thing, so taking it releases it elsewhere. */
      if (column !== null) {
        for (const other of IMPORT_FIELDS) {
          if (other !== field && next[other] === column) next[other] = null;
        }
      }

      return next;
    });

  const canContinue =
    step === 1 ? mapping !== null && isMappingComplete(mapping) : step === 2 && summary.ready > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={X} label="Close" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Import from CSV
        </Typography>
      </View>

      <View className="px-5 py-4">
        <StepIndicator steps={STEPS} current={step} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-6"
        showsVerticalScrollIndicator={false}>
        {/* ---- 1. Choose a file ---------------------------------------- */}
        {step === 0 && (
          <View className="gap-3">
            <SectionHeader label="On this device" />
            <View className="rounded-3xl bg-surface">
              {pickableFiles.map((candidate, index) => (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  onPress={() => choose(candidate)}
                  className={
                    index === 0
                      ? 'flex-row items-center gap-3 px-4 py-3.5 active:opacity-60'
                      : 'flex-row items-center gap-3 border-t border-border px-4 py-3.5 active:opacity-60'
                  }>
                  <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                    <Icon icon={FileSpreadsheet} color="iris" size={16} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Typography type="body-sm" weight="medium" truncate>
                      {candidate.name}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {candidate.size}
                    </Typography>
                  </View>
                </Pressable>
              ))}
            </View>
            <Typography type="body-xs" color="muted" className="px-1">
              Pick the file you exported from your spreadsheet. The first row is read as column
              names.
            </Typography>
          </View>
        )}

        {/* ---- 2. Map columns ------------------------------------------ */}
        {step === 1 && table && mapping && (
          <View className="gap-4">
            <SectionHeader
              label="Which column is which"
              trailing={
                <Typography type="body-sm" color="muted">
                  {`${table.headers.length} columns`}
                </Typography>
              }
            />

            {IMPORT_FIELDS.map((field) => (
              <View key={field} className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Typography type="body-sm" weight="medium">
                    {IMPORT_FIELD_LABELS[field]}
                  </Typography>
                  {REQUIRED_FIELDS.includes(field) && (
                    <Typography type="body-xs" color="muted">
                      required
                    </Typography>
                  )}
                </View>

                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: mapping[field] === null }}
                    onPress={() => assign(field, null)}
                    className={mapping[field] === null ? CHIP.on : CHIP.off}>
                    <Typography
                      type="body-xs"
                      weight="medium"
                      className={mapping[field] === null ? CHIP_LABEL.on : CHIP_LABEL.off}>
                      Ignore
                    </Typography>
                  </Pressable>

                  {table.headers.map((header, column) => (
                    <Pressable
                      key={header + column}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mapping[field] === column }}
                      onPress={() => assign(field, column)}
                      className={mapping[field] === column ? CHIP.on : CHIP.off}>
                      <Typography
                        type="body-xs"
                        weight="medium"
                        className={mapping[field] === column ? CHIP_LABEL.on : CHIP_LABEL.off}>
                        {header}
                      </Typography>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            {!isMappingComplete(mapping) && (
              <Typography type="body-xs" className="text-danger">
                Date, Item and Amount all need a column — an expense can’t exist without them.
              </Typography>
            )}
          </View>
        )}

        {/* ---- 3. Preview ---------------------------------------------- */}
        {step === 2 && (
          <View className="gap-3">
            <SectionHeader
              label="What will be created"
              trailing={
                <Typography type="body-sm" color="muted">
                  {`${summary.total} rows`}
                </Typography>
              }
            />

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1 rounded-3xl bg-surface p-4">
                <Typography type="body-xs" color="muted">
                  Ready
                </Typography>
                <Typography type="h4" weight="bold" className="text-accent">
                  {String(summary.ready)}
                </Typography>
              </View>
              <View className="flex-1 gap-1 rounded-3xl bg-surface p-4">
                <Typography type="body-xs" color="muted">
                  Skipped
                </Typography>
                <Typography
                  type="h4"
                  weight="bold"
                  className={summary.blocked > 0 ? 'text-danger' : 'text-muted'}>
                  {String(summary.blocked)}
                </Typography>
              </View>
            </View>

            <View className="rounded-3xl bg-surface">
              {rows.slice(0, PREVIEW_LIMIT).map((row, index) => (
                <PreviewRow key={row.index} row={row} isFirst={index === 0} />
              ))}
            </View>

            {rows.length > PREVIEW_LIMIT && (
              <Typography type="body-xs" color="muted" className="px-1">
                {`and ${rows.length - PREVIEW_LIMIT} more rows`}
              </Typography>
            )}

            <Typography type="body-xs" color="muted" className="px-1">
              Rows with a problem are skipped, not guessed at. Fix them in the spreadsheet and
              import again — nothing already recorded is touched either way.
            </Typography>
          </View>
        )}

        {/* ---- 4. Done -------------------------------------------------- */}
        {step === 3 && (
          <View className="items-center gap-3 py-10">
            <View className="size-14 items-center justify-center rounded-full bg-surface">
              <Icon icon={CircleCheck} color="accent" size={28} />
            </View>
            <Typography type="h5" weight="semibold">
              {`${summary.ready} expenses imported`}
            </Typography>
            <Typography type="body-sm" color="muted" align="center">
              {summary.blocked > 0
                ? `${summary.blocked} rows were skipped because of the problems listed on the previous step.`
                : 'Every row came across cleanly.'}
            </Typography>
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-3 border-t border-border px-5 pt-3">
        {step > 0 && step < 3 && (
          <View className="flex-1">
            <Button tone="secondary" label="Back" onPress={() => setStep((s) => s - 1)} />
          </View>
        )}

        <View className="flex-1">
          {step === 3 ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : (
            <Button
              label={step === 2 ? `Import ${summary.ready}` : 'Continue'}
              isDisabled={step === 0 || !canContinue}
              onPress={() => setStep((s) => s + 1)}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
