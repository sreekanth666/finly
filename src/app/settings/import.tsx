import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { CircleCheck, FileSpreadsheet, TriangleAlert, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { StepIndicator } from '@/components/step-indicator';
import { formatDateLong } from '@/domain/period';
import { useAction } from '@/db/use-action';
import { pickCsvFile, type PickedFile } from '@/features/data-transfer/files';
import { planImport, runImport } from '@/features/data-transfer/import';
import {
  buildRows,
  DATE_ORDER_LABELS,
  inferDateOrder,
  type DateOrder,
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
            fractionClassName="type-amount-sm"
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
  const [file, setFile] = useState<PickedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy');
  const [orderConfident, setOrderConfident] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [pickError, setPickError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runImport>> | null>(null);

  const importAction = useAction(runImport);

  const table = useMemo(() => (file ? parseCsv(file.content) : null), [file]);
  const rows = useMemo(
    () => (table && mapping ? buildRows(table, mapping, dateOrder) : []),
    [table, mapping, dateOrder]
  );
  const summary = useMemo(() => summarise(rows), [rows]);
  const plan = useMemo(() => (rows.length > 0 ? planImport(rows) : null), [rows]);

  const choose = async () => {
    setPickError(null);
    try {
      const picked = await pickCsvFile();
      if (picked === null) return;

      const parsed = parseCsv(picked.content);
      if (parsed.headers.length === 0) {
        setPickError('That file has no column names in its first row.');
        return;
      }

      const guessed = guessMapping(parsed.headers);
      setFile(picked);
      /* The guess is a starting point, not a decision — step 2 shows it. */
      setMapping(guessed);

      /* Infer the date order from the file, and remember whether the file could
         actually settle it — an unconfident guess has to be shown, not applied
         silently. */
      const dates =
        guessed.date === null ? [] : parsed.rows.map((row) => row[guessed.date!] ?? '');
      const inferred = inferDateOrder(dates);
      setDateOrder(inferred.order);
      setOrderConfident(inferred.confident);

      setStep(1);
    } catch (cause) {
      setPickError(cause instanceof Error ? cause.message : String(cause));
    }
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

  /** The first readable date, spelled out the way the chosen order reads it. */
  const firstDatePreview = useMemo(() => {
    const row = rows.find((candidate) => candidate.occurredAt !== null);
    if (row === undefined) return null;
    return `“${row.date}” will be read as ${formatDateLong(row.occurredAt!)}`;
  }, [rows]);

  const canContinue =
    step === 1 ? mapping !== null && isMappingComplete(mapping) : step === 2 && summary.ready > 0;

  const runTheImport = async () => {
    const outcome = await importAction.run(rows, { skipDuplicates });
    if (!outcome.ok) return;
    setResult(outcome.value);
    setStep(3);
  };

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
            <SectionHeader label="Choose a file" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a CSV file"
              onPress={choose}
              className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-4 active:opacity-60">
              <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
                <Icon icon={FileSpreadsheet} color="iris" size={16} />
              </View>
              <View className="flex-1 gap-0.5">
                <Typography type="body-sm" weight="medium">
                  {file === null ? 'Pick a CSV file' : file.name}
                </Typography>
                <Typography type="body-xs" color="muted">
                  Exported from your spreadsheet or bank
                </Typography>
              </View>
            </Pressable>

            {pickError !== null && (
              <Typography type="body-xs" className="text-danger px-1">
                {pickError}
              </Typography>
            )}

            <Typography type="body-xs" color="muted" className="px-1">
              The first row is read as column names. Nothing is written until you have seen what
              will be imported.
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

            <View className="gap-2 border-t border-border pt-4">
              <View className="flex-row items-center gap-2">
                <Typography type="body-sm" weight="medium">
                  Date format
                </Typography>
                {!orderConfident && (
                  <Typography type="body-xs" className="text-warning">
                    please check
                  </Typography>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2">
                {(Object.keys(DATE_ORDER_LABELS) as DateOrder[]).map((order) => (
                  <Pressable
                    key={order}
                    accessibilityRole="button"
                    accessibilityState={{ selected: dateOrder === order }}
                    onPress={() => setDateOrder(order)}
                    className={dateOrder === order ? CHIP.on : CHIP.off}>
                    <Typography
                      type="body-xs"
                      weight="medium"
                      className={dateOrder === order ? CHIP_LABEL.on : CHIP_LABEL.off}>
                      {DATE_ORDER_LABELS[order]}
                    </Typography>
                  </Pressable>
                ))}
              </View>

              {/* Reading 03/04 the wrong way round files every row in the wrong
                  month, silently. Showing the first date as it will actually be
                  read is the only way the user can catch that. */}
              {firstDatePreview !== null && (
                <Typography type="body-xs" color="muted">
                  {firstDatePreview}
                </Typography>
              )}
              {!orderConfident && (
                <Typography type="body-xs" className="text-warning">
                  Every date in this file could be read either way round. Check the example above
                  before continuing.
                </Typography>
              )}
            </View>

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

            {plan !== null && (plan.newAccounts.length > 0 || plan.newCategories.length > 0) && (
              <View className="gap-1 rounded-3xl bg-surface px-4 py-3">
                <Typography type="body-sm" weight="semibold">
                  Will also be created
                </Typography>
                {plan.newAccounts.length > 0 && (
                  <Typography type="body-xs" color="muted">
                    {`${plan.newAccounts.length === 1 ? 'Account' : 'Accounts'}: ${plan.newAccounts.join(', ')}`}
                  </Typography>
                )}
                {plan.newCategories.length > 0 && (
                  <Typography type="body-xs" color="muted">
                    {`${plan.newCategories.length === 1 ? 'Category' : 'Categories'}: ${plan.newCategories.join(', ')}`}
                  </Typography>
                )}
                <Typography type="body-xs" color="muted">
                  Imported accounts are added as bank accounts — a statement doesn’t say what kind
                  it is, and a card needs a credit limit the file can’t supply.
                </Typography>
              </View>
            )}

            {plan !== null && plan.duplicates.length > 0 && (
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: skipDuplicates }}
                onPress={() => setSkipDuplicates((current) => !current)}
                className="gap-1 rounded-3xl bg-surface px-4 py-3 active:opacity-60">
                <View className="flex-row items-center justify-between gap-3">
                  <Typography type="body-sm" weight="semibold" className="flex-1">
                    {`Skip ${plan.duplicates.length} that look already recorded`}
                  </Typography>
                  <Typography
                    type="body-xs"
                    weight="semibold"
                    className={skipDuplicates ? 'text-accent' : 'text-muted'}>
                    {skipDuplicates ? 'Skipping' : 'Importing'}
                  </Typography>
                </View>
                <Typography type="body-xs" color="muted">
                  Same date, description and amount as an expense you already have. Two identical
                  coffees on one day look the same as one imported twice, so this is your call.
                </Typography>
              </Pressable>
            )}

            {importAction.errorMessage !== null && (
              <Typography type="body-xs" className="text-danger px-1">
                {importAction.errorMessage}
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
              {`${result?.imported ?? 0} expenses imported`}
            </Typography>
            <Typography type="body-sm" color="muted" align="center">
              {/* What actually happened, not what was predicted. The design pass
                  claimed a number here having written nothing at all. */}
              {[
                summary.blocked > 0 ? `${summary.blocked} rows had problems` : null,
                (result?.skipped ?? 0) > 0 ? `${result?.skipped} looked already recorded` : null,
                (result?.createdAccounts ?? 0) > 0
                  ? `${result?.createdAccounts} accounts created`
                  : null,
                (result?.createdCategories ?? 0) > 0
                  ? `${result?.createdCategories} categories created`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Every row came across cleanly.'}
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
              label={
                importAction.isPending
                  ? 'Importing…'
                  : step === 2
                    ? `Import ${summary.ready}`
                    : 'Continue'
              }
              isDisabled={step === 0 || !canContinue || importAction.isPending}
              onPress={() => {
                if (step === 2) void runTheImport();
                else setStep((s) => s + 1);
              }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
