import { Input, Typography } from 'heroui-native';
import { CircleCheck, Info, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from './button';
import { FilterChipBar, type FilterOption } from './filter-chip-bar';
import { FormScreen } from './form-screen';
import { Icon } from './icon';
import { SectionHeader } from './section-header';
import { TemplateShare } from './template-share';
import { FieldPicker, TokenTagger } from './token-tagger';

import { useSubmitOnce } from '@/db/use-action';
import { formatMinor, formatMinorPlain, type Minor } from '@/domain/money';
import {
  appHint,
  bindingOf,
  checkTemplate,
  compileTemplate,
  deriveSegments,
  detect,
  hasBinding,
  isGatedKind,
  labelOf,
  maskMessage,
  normaliseText,
  readsBack,
  suggestTags,
  taggedValues,
  tapToken,
  tokenise,
  type Detection,
  type Tag,
  type TemplateField,
  type TemplateOutcome,
  type TemplateSpec,
} from '@/domain/txn-detect';
import { previewTemplate, useCreateTemplate, useRecentMessages } from '@/features/capture/templates';

export type TemplateSample = {
  body: string;
  sender: string | null;
  title: string | null;
  packageName: string | null;
  receivedAt: number;
};

export type TemplateEditorProps = {
  /** The message to teach from. Null asks the user to paste one. */
  sample: TemplateSample | null;
  onClose: () => void;
};

type Step = 'sample' | 'tag' | 'saved';

const OUTCOMES: FilterOption<TemplateOutcome>[] = [
  { id: 'transaction', label: 'A payment' },
  { id: 'transfer', label: 'A transfer' },
  { id: 'ignore', label: 'Not a payment' },
];

const DIRECTIONS: FilterOption<'debit' | 'credit'>[] = [
  { id: 'debit', label: 'Money went out' },
  { id: 'credit', label: 'Money came in' },
];

const FIELDS: readonly TemplateField[] = ['amount', 'counterparty', 'reference', 'tail'];

const HINTS: Record<TemplateField, string> = {
  amount: 'Tap the amount that was paid.',
  counterparty: 'Tap the first word of the name, then the last. Tap an end again to trim it.',
  reference: 'Optional. Tap the reference or UPI number.',
  tail: 'Optional. Tap the last digits of your card or account.',
};

/** Where this template is only a draft, it still needs an id to recognise its own matches. */
const DRAFT_ID = 'draft';

const moneyText = (amountMinor: Minor, currency: string | null) =>
  currency === null || currency === 'INR' ? formatMinor(amountMinor) : `${currency} ${formatMinorPlain(amountMinor)}`;

function Reading({ detection }: { detection: Detection }) {
  const rows = [
    detection.amountMinor === null ? null : ['Amount', moneyText(detection.amountMinor, detection.currency)],
    detection.counterparty === null
      ? null
      : [detection.direction === 'credit' ? 'From' : 'Paid to', labelOf(detection.counterparty) ?? detection.counterparty],
    detection.reference === null ? null : ['Reference', detection.reference],
    detection.instrumentTail === null ? null : ['Card or account', `••${detection.instrumentTail}`],
  ].filter((row): row is string[] => row !== null);

  return (
    <View className="gap-1">
      {rows.map(([label, value]) => (
        <View key={label} className="flex-row justify-between gap-3">
          <Typography type="body-xs" color="muted">
            {label}
          </Typography>
          <Typography type="body-xs" weight="semibold" className="shrink text-right">
            {value}
          </Typography>
        </View>
      ))}
    </View>
  );
}

/**
 * Teaching Finly a message format (D18), for someone who has never heard the
 * word "template": say what the message is, tap its parts, check what Finly
 * would read, save. Finly has already tagged what it could find, so the usual
 * session is one or two taps.
 *
 * Nothing is saved until the format reads its own example back exactly, and
 * the preview shows which other recent messages from the same sender it would
 * claim — an OTP appearing there is how a too-broad format shows itself.
 */
export function TemplateEditor({ sample, onClose }: TemplateEditorProps) {
  const [now] = useState(() => Date.now());
  const [pasted, setPasted] = useState('');
  const message = useMemo<TemplateSample>(
    () => sample ?? { body: pasted, sender: null, title: null, packageName: null, receivedAt: now },
    [sample, pasted, now],
  );

  const [step, setStep] = useState<Step>('sample');
  const [outcome, setOutcome] = useState<TemplateOutcome>('transaction');
  const [direction, setDirection] = useState<'debit' | 'credit'>(() =>
    sample === null ? 'debit' : (detect(sample).direction ?? 'debit'),
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeField, setActiveField] = useState<TemplateField>('amount');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<{ spec: TemplateSpec; masked: string } | null>(null);

  const recent = useRecentMessages();
  const create = useCreateTemplate();

  const text = useMemo(() => normaliseText(message.body), [message.body]);
  const tokens = useMemo(() => tokenise(text), [text]);
  const reading = useMemo(() => detect(message), [message]);
  const binding = useMemo(() => bindingOf(message), [message]);
  const app = appHint(message.packageName);

  const directionWord = outcome === 'ignore' ? 'muted' : outcome === 'transfer' ? 'transfer' : direction === 'credit' ? 'money in' : 'money out';
  const who = binding.issuer ?? binding.senderKey ?? app?.name ?? 'This sender';
  const finalName = name.trim().length > 0 ? name.trim() : `${who} · ${directionWord}`;

  const spec = useMemo<TemplateSpec>(
    () => ({
      id: DRAFT_ID,
      name: finalName,
      binding,
      outcome,
      direction: outcome === 'ignore' ? null : direction,
      overridesGate: isGatedKind(reading.kind) ? reading.kind : null,
      segments: deriveSegments(text, outcome === 'ignore' ? [] : tags),
      updatedAt: now,
    }),
    [finalName, binding, outcome, direction, reading.kind, text, tags, now],
  );

  const compiled = useMemo(() => compileTemplate(spec), [spec]);
  const check = useMemo(() => checkTemplate(spec), [spec]);
  const readsItself = useMemo(
    () =>
      outcome === 'ignore'
        ? compiled !== null && compiled.pattern.test(text)
        : readsBack(spec, text, taggedValues(text, tags)),
    [outcome, compiled, spec, text, tags],
  );
  const taught = useMemo(
    () => (compiled === null ? null : detect(message, { templates: [compiled] })),
    [compiled, message],
  );
  const preview = useMemo(
    () => (step === 'tag' ? previewTemplate(spec, recent.data ?? [], message.body) : []),
    [step, spec, recent.data, message.body],
  );

  const saveOnce = useSubmitOnce(async () => {
    if (check.errors.length > 0 || !readsItself) return false;
    const masked = maskMessage(text);
    const outcomeOfSave = await create.run({
      name: finalName,
      binding: spec.binding,
      outcome: spec.outcome,
      direction: spec.direction,
      overridesGate: spec.overridesGate,
      segments: spec.segments,
      sampleMasked: masked,
    });
    if (!outcomeOfSave.ok) return false;
    setSaved({ spec: { ...spec, id: outcomeOfSave.value, name: finalName }, masked });
    setStep('saved');
    return true;
  });

  const goToTagging = () => {
    if (outcome !== 'ignore' && tags.length === 0) {
      setTags(
        suggestTags(text, {
          amountMinor: reading.amountMinor,
          counterparty: reading.counterparty,
          reference: reading.reference,
          instrumentTail: reading.instrumentTail,
        }),
      );
    }
    setStep('tag');
  };

  const done = new Set(tags.map((tag) => tag.field));
  const blocker =
    check.errors[0] ??
    (readsItself
      ? null
      : outcome === 'ignore'
        ? 'This message could not be matched. Try again from the message itself.'
        : 'Tap the amount and the name so Finly can read this message back.');

  /* ---------------------------------------------------------------------- */

  if (step === 'saved' && saved !== null) {
    return (
      <FormScreen
        title="Format saved"
        closeIcon={X}
        closeLabel="Close"
        onClose={onClose}
        contentContainerClassName="gap-4 px-5 pb-6 pt-2"
        footer={<Button label="Done" onPress={onClose} />}>
        <View className="flex-row gap-3 rounded-2xl bg-surface p-4">
          <Icon icon={CircleCheck} color="accent" size={18} />
          <Typography type="body-sm" className="flex-1">
            {saved.spec.outcome === 'ignore'
              ? `Messages like this from ${who} will be filed away instead of waiting for review.`
              : `Finly will read messages like this from ${who} this way from now on. Anything waiting in the inbox from them has been read again.`}
          </Typography>
        </View>
        <Typography type="body-sm" color="muted">
          Help Finly read this for everyone. Send the format to the developer and it can be built into the next
          update.
        </Typography>
        <TemplateShare
          maskedMessage={saved.masked}
          template={saved.spec}
          sender={binding.senderKey ?? binding.issuer}
          initiallyOpen
        />
      </FormScreen>
    );
  }

  if (step === 'sample') {
    return (
      <FormScreen
        title="Teach Finly a format"
        closeIcon={X}
        closeLabel="Close"
        onClose={onClose}
        contentContainerClassName="gap-5 px-5 pb-6 pt-2"
        footer={<Button label="Next" isDisabled={text.length === 0} onPress={goToTagging} />}>
        <Typography type="body-sm" color="muted">
          Show Finly how to read messages like this one. It will read every future message from the same sender the
          same way.
        </Typography>

        {sample === null ? (
          <Input
            placeholder="Paste a message from your bank, card or payment app"
            value={pasted}
            onChangeText={setPasted}
            multiline
            numberOfLines={6}
            autoFocus
            accessibilityLabel="Message"
          />
        ) : (
          <View className="rounded-2xl bg-surface p-3">
            <Typography type="body-sm" selectable>
              {sample.body}
            </Typography>
          </View>
        )}

        {text.length > 0 &&
          (hasBinding(binding) ? (
            <Typography type="body-xs" color="muted">
              {`From ${[binding.senderKey, binding.issuer, app?.name].filter((part): part is string => part != null).join(' · ')}`}
            </Typography>
          ) : (
            <View className="flex-row gap-2 rounded-2xl bg-surface p-3">
              <Icon icon={Info} color="warning" size={14} />
              <Typography type="body-xs" color="muted" className="flex-1">
                Finly can’t tell which bank or app sent this, so it couldn’t keep the format to them. Teach it from a
                message Finly caught itself, or paste one that names the bank.
              </Typography>
            </View>
          ))}

        <View className="gap-2">
          <SectionHeader label="What is this message?" />
          <FilterChipBar options={OUTCOMES} selectedId={outcome} onSelect={setOutcome} />
          <Typography type="body-xs" color="muted">
            {outcome === 'transaction'
              ? 'Money you spent or received. It will wait in the inbox for you to confirm.'
              : outcome === 'transfer'
                ? 'A card bill, an investment, or money moved to your own account. Kept out of spending.'
                : 'Messages like this will be filed away instead of waiting for review.'}
          </Typography>
        </View>

        {outcome !== 'ignore' && (
          <View className="gap-2">
            <SectionHeader label="Which way did the money go?" />
            <FilterChipBar options={DIRECTIONS} selectedId={direction} onSelect={setDirection} />
          </View>
        )}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={outcome === 'ignore' ? 'Mute this format' : 'Tap the parts'}
      closeIcon={X}
      closeLabel="Close"
      onClose={onClose}
      contentContainerClassName="gap-5 px-5 pb-6 pt-2"
      footer={
        <>
          {(create.errorMessage ?? blocker) !== null && (
            <Typography type="body-xs" className={create.errorMessage !== null ? 'text-danger' : undefined} color={create.errorMessage !== null ? undefined : 'muted'}>
              {create.errorMessage ?? blocker}
            </Typography>
          )}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Back" tone="secondary" onPress={() => setStep('sample')} />
            </View>
            <View className="flex-1">
              <Button
                label={create.isPending ? 'Saving…' : 'Save format'}
                isDisabled={blocker !== null || create.isPending}
                onPress={() => void saveOnce.submit()}
              />
            </View>
          </View>
        </>
      }>
      {outcome !== 'ignore' && (
        <View className="gap-3">
          <Typography type="body-sm" color="muted">
            Finly has marked what it could find. Pick a part below, then tap it in the message to fix anything that’s
            wrong.
          </Typography>
          <FieldPicker
            fields={FIELDS}
            active={activeField}
            onChange={setActiveField}
            labels={{ counterparty: direction === 'credit' ? 'Received from' : 'Paid to' }}
            done={done}
          />
          <Typography type="body-xs" color="muted">
            {HINTS[activeField]}
          </Typography>
          <TokenTagger
            tokens={tokens}
            tags={tags}
            onTap={(index) => setTags((current) => tapToken(tokens, current, activeField, index))}
          />
        </View>
      )}

      <View className="gap-2">
        <SectionHeader label="What Finly will read" />
        <View className="gap-2 rounded-2xl bg-surface p-3">
          {readsItself && taught !== null ? (
            outcome === 'ignore' ? (
              <Typography type="body-xs" color="muted">
                Filed away as not a payment.
              </Typography>
            ) : (
              <Reading detection={taught} />
            )
          ) : (
            <Typography type="body-xs" color="muted">
              {blocker ?? 'Nothing yet.'}
            </Typography>
          )}
          {check.warnings.map((warning) => (
            <View key={warning} className="flex-row gap-2">
              <Icon icon={Info} color="warning" size={14} />
              <Typography type="body-xs" color="muted" className="flex-1">
                {warning}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <SectionHeader label="Other messages from this sender" />
        {preview.length === 0 ? (
          <Typography type="body-xs" color="muted">
            No other recent messages from this sender to try it on.
          </Typography>
        ) : (
          <View className="gap-2">
            {preview.map((row) => (
              <View key={row.key} className="gap-1 rounded-2xl bg-surface p-3">
                <Typography type="body-xs" color="muted" numberOfLines={2}>
                  {row.body}
                </Typography>
                {row.reading === null ? (
                  <Typography type="body-xs" color="muted">
                    Not this format — read as usual.
                  </Typography>
                ) : outcome === 'ignore' ? (
                  <Typography type="body-xs" className="text-accent">
                    Would be filed away.
                  </Typography>
                ) : (
                  <Reading detection={row.reading} />
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="gap-2">
        <SectionHeader label="Name" />
        <Input placeholder={finalName} value={name} onChangeText={setName} accessibilityLabel="Format name" />
      </View>
    </FormScreen>
  );
}
