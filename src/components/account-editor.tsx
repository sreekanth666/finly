import { Input, Typography } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { SectionHeader } from './section-header';

import {
  ACCOUNT_COLOR_TOKENS,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  type AccountColorToken,
  type AccountType,
} from '@/data/accounts';
import { useAppColor } from '@/theme';

export type AccountDraft = {
  name: string;
  type: AccountType;
  issuer: string;
  last4: string;
  creditLimit: string;
  statementDay: string;
  colorToken: AccountColorToken;
};

const EMPTY_DRAFT: AccountDraft = {
  name: '',
  type: 'credit_card',
  issuer: '',
  last4: '',
  creditLimit: '',
  statementDay: '',
  colorToken: 'accent',
};

const TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((id) => ({
  id,
  label: ACCOUNT_TYPE_LABELS[id],
}));

const isValidStatementDay = (value: string) => {
  if (value.length === 0) return true;
  const day = Number(value);

  return Number.isInteger(day) && day >= 1 && day <= 31;
};

export type AccountEditorProps = {
  title: string;
  initial?: Partial<AccountDraft>;
  submitLabel: string;
  onSubmit: (draft: AccountDraft) => void;
  onClose: () => void;
};

/**
 * One editor, two routes — the same split as ExpenseForm serving add and edit.
 *
 * Credit limit and statement day appear only for a credit card, mirroring the
 * CHECK constraints in §5: the table requires a limit for cards and has no use
 * for one anywhere else.
 */
export function AccountEditor({
  title,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: AccountEditorProps) {
  const seed = { ...EMPTY_DRAFT, ...initial };
  const [draft, setDraft] = useState<AccountDraft>(seed);
  const swatches = useAppColor(ACCOUNT_COLOR_TOKENS);

  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const isCard = draft.type === 'credit_card';
  const last4Valid = draft.last4.length === 0 || draft.last4.length === 4;
  const statementDayValid = isValidStatementDay(draft.statementDay);
  const canSave = draft.name.trim().length > 0 && last4Valid && statementDayValid;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={onClose} />
        <Typography type="body" weight="semibold">
          {title}
        </Typography>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 pb-6 pt-2"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2 py-2">
          <View className="size-16 items-center justify-center rounded-3xl bg-surface">
            <Icon icon={ACCOUNT_TYPE_ICONS[draft.type]} color={draft.colorToken} size={28} />
          </View>
          <Typography type="body-sm" color="muted">
            {ACCOUNT_TYPE_LABELS[draft.type]}
          </Typography>
        </View>

        <View className="gap-2 px-5">
          <SectionHeader label="Name" />
          <Input
            placeholder="HDFC Millennia"
            value={draft.name}
            onChangeText={(value) => set('name', value)}
          />
        </View>

        <View className="gap-2">
          <View className="px-5">
            <SectionHeader label="Type" />
          </View>
          <FilterChipBar
            options={TYPE_OPTIONS}
            selectedId={draft.type}
            onSelect={(type) => set('type', type)}
          />
        </View>

        <View className="gap-2 px-5">
          <SectionHeader label="Issuer" />
          <Input
            placeholder="HDFC Bank"
            value={draft.issuer}
            onChangeText={(value) => set('issuer', value)}
          />
        </View>

        <View className="gap-2 px-5">
          <SectionHeader label="Last 4 digits" />
          <Input
            placeholder="4821"
            value={draft.last4}
            onChangeText={(value) => set('last4', value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
          />
          {!last4Valid && (
            <Typography type="body-xs" className="text-danger">
              Enter all four digits, or leave it blank.
            </Typography>
          )}
        </View>

        {isCard && (
          <>
            <View className="gap-2 px-5">
              <SectionHeader label="Credit limit" />
              <Input
                placeholder="4000"
                value={draft.creditLimit}
                onChangeText={(value) => set('creditLimit', value.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
              />
              <Typography type="body-xs" color="muted">
                Utilisation is this cycle’s spend against the limit.
              </Typography>
            </View>

            <View className="gap-2 px-5">
              <SectionHeader label="Statement day" />
              <Input
                placeholder="18"
                value={draft.statementDay}
                onChangeText={(value) => set('statementDay', value.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Typography
                type="body-xs"
                className={statementDayValid ? 'text-muted' : 'text-danger'}>
                {statementDayValid
                  ? 'A day past the end of a short month falls back to its last day.'
                  : 'Pick a day between 1 and 31.'}
              </Typography>
            </View>
          </>
        )}

        <View className="gap-2 px-5">
          <SectionHeader label="Colour" />
          <View className="flex-row gap-3">
            {ACCOUNT_COLOR_TOKENS.map((token, index) => (
              <Pressable
                key={token}
                accessibilityRole="button"
                accessibilityLabel={token}
                accessibilityState={{ selected: draft.colorToken === token }}
                onPress={() => set('colorToken', token)}
                className={
                  draft.colorToken === token
                    ? 'size-10 items-center justify-center rounded-full border-2 border-foreground'
                    : 'size-10 items-center justify-center rounded-full border-2 border-transparent active:opacity-60'
                }>
                <View
                  className="size-7 rounded-full"
                  style={{ backgroundColor: swatches[index] }}
                />
              </Pressable>
            ))}
          </View>
          <Typography type="body-xs" color="muted">
            Stored as a theme token, so it follows the palette rather than pinning a colour.
          </Typography>
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 pt-3">
        <Button label={submitLabel} isDisabled={!canSave} onPress={() => onSubmit(draft)} />
      </View>
    </SafeAreaView>
  );
}
