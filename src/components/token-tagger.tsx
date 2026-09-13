import { Typography } from 'heroui-native';
import { Pressable, View } from 'react-native';

import type { Tag, TemplateField, Token } from '@/domain/txn-detect';

/**
 * Spelled out per field, not assembled from a template, so the CSS compiler
 * sees every class. Colours are the chart tokens — the only palette meant for
 * telling several things apart — so nothing here is a literal.
 */
const TAGGED: Record<TemplateField, string> = {
  amount: 'rounded-lg border-2 border-accent bg-surface-secondary px-2 py-1 active:opacity-60',
  counterparty: 'rounded-lg border-2 border-chart-2 bg-surface-secondary px-2 py-1 active:opacity-60',
  reference: 'rounded-lg border-2 border-chart-3 bg-surface-secondary px-2 py-1 active:opacity-60',
  tail: 'rounded-lg border-2 border-chart-4 bg-surface-secondary px-2 py-1 active:opacity-60',
};
const UNTAGGED = 'rounded-lg border-2 border-border bg-surface px-2 py-1 active:opacity-60';

const DOT: Record<TemplateField, string> = {
  amount: 'size-2.5 rounded-full bg-accent',
  counterparty: 'size-2.5 rounded-full bg-chart-2',
  reference: 'size-2.5 rounded-full bg-chart-3',
  tail: 'size-2.5 rounded-full bg-chart-4',
};

export const FIELD_WORDS: Record<TemplateField, string> = {
  amount: 'Amount',
  counterparty: 'Paid to',
  reference: 'Reference',
  tail: 'Card or account no.',
};

export type FieldPickerProps = {
  fields: readonly TemplateField[];
  active: TemplateField;
  onChange: (field: TemplateField) => void;
  /** Overrides a field's name — "Received from" for money in. */
  labels?: Partial<Record<TemplateField, string>>;
  /** Fields already tagged, which get a tick. */
  done: ReadonlySet<TemplateField>;
};

/** Which field the next tap tags. Each carries the colour its tagged words get. */
export function FieldPicker({ fields, active, onChange, labels = {}, done }: FieldPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {fields.map((field) => {
        const isActive = field === active;
        const label = `${labels[field] ?? FIELD_WORDS[field]}${done.has(field) ? ' ✓' : ''}`;
        return (
          <Pressable
            key={field}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Tag the ${labels[field] ?? FIELD_WORDS[field]}`}
            onPress={() => onChange(field)}
            className={
              isActive
                ? 'flex-row items-center gap-2 rounded-full border border-accent bg-surface px-3 py-1.5 active:opacity-60'
                : 'flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 active:opacity-60'
            }>
            <View className={DOT[field]} />
            <Typography type="body-xs" color={isActive ? 'default' : 'muted'}>
              {label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

export type TokenTaggerProps = {
  tokens: readonly Token[];
  tags: readonly Tag[];
  onTap: (index: number) => void;
};

/**
 * The message as tappable pieces, one row per line, each piece outlined in the
 * colour of the field it is tagged as. Line breaks are rows, not pieces: a
 * person cannot tap a line break, and should not have to.
 */
export function TokenTagger({ tokens, tags, onTap }: TokenTaggerProps) {
  const fieldOf = (index: number) => tags.find((tag) => index >= tag.start && index < tag.end)?.field ?? null;

  const lines: { index: number; token: Token }[][] = [[]];
  tokens.forEach((token, index) => {
    if (token.kind === 'newline') lines.push([]);
    else lines[lines.length - 1].push({ index, token });
  });

  return (
    <View className="gap-2 rounded-2xl bg-surface p-3">
      {lines
        .filter((line) => line.length > 0)
        .map((line) => (
          <View key={line[0].index} className="flex-row flex-wrap gap-1.5">
            {line.map(({ index, token }) => {
              const field = fieldOf(index);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={field === null ? token.text : `${token.text}, tagged as ${FIELD_WORDS[field]}`}
                  hitSlop={2}
                  onPress={() => onTap(index)}
                  className={field === null ? UNTAGGED : TAGGED[field]}>
                  <Typography type="body-sm">{token.text}</Typography>
                </Pressable>
              );
            })}
          </View>
        ))}
    </View>
  );
}
