import { Typography } from 'heroui-native';
import { ArrowDownLeft, Check, CircleHelp } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { iconFor } from './icon-registry';

import type { CandidateSummary } from '@/db/repositories/captures';
import { speakMinor } from '@/domain/money';
import { formatDayLabel, formatTime } from '@/domain/period';
import { alsoSeenLine, kindLabel, originLine } from '@/features/capture/presentation';
import { toAppColor } from '@/theme';

export type CandidateRowProps = {
  candidate: CandidateSummary;
  onPress: () => void;
  /** Present only when the candidate can be confirmed as read. */
  onConfirm?: () => void;
};

/** One detected payment: what it looks like, where it came from, and a quick confirm. */
function CandidateRowBase({ candidate, onPress, onConfirm }: CandidateRowProps) {
  const isCredit = candidate.direction === 'credit';
  const isUnsure = candidate.confidence === 'low' || candidate.kind === 'unknown';
  const tag = kindLabel(candidate.kind);
  const also = alsoSeenLine(candidate);

  const tileIcon = isCredit
    ? ArrowDownLeft
    : isUnsure
      ? CircleHelp
      : iconFor(candidate.category?.icon);
  const tileTone = isCredit ? 'income' : toAppColor(candidate.category?.colorToken ?? 'muted', 'muted');

  const when = `${formatDayLabel(candidate.occurredAt)} ${formatTime(candidate.occurredAt)}`;
  const spoken = [
    candidate.item,
    tag,
    candidate.amountMinor === null ? 'amount not read' : speakMinor(candidate.amountMinor),
    isCredit ? 'received' : null,
    when,
    originLine(candidate),
    also,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  return (
    <View className="flex-row items-center gap-2 rounded-2xl bg-background py-2 pl-3 pr-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        onPress={onPress}
        className="flex-1 flex-row items-center gap-3 active:opacity-60">
        <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
          <Icon icon={tileIcon} color={tileTone} size={18} />
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Typography type="body-sm" weight="semibold" className="shrink" truncate>
              {candidate.item}
            </Typography>
            {tag !== null && (
              <View className="rounded-full bg-surface-secondary px-1.5 py-0.5">
                <Typography type="body-xs" color="muted">
                  {tag}
                </Typography>
              </View>
            )}
          </View>
          <Typography type="body-xs" color="muted" truncate>
            {also === null ? originLine(candidate) : `${originLine(candidate)} · ${also}`}
          </Typography>
        </View>

        <View className="items-end gap-0.5">
          {candidate.amountMinor === null ? (
            <Typography type="body-sm" color="muted">
              No amount
            </Typography>
          ) : (
            <Amount
              value={candidate.amountMinor}
              sign={isCredit ? 'always' : 'negative'}
              className={`type-amount-sm ${isCredit ? 'text-income' : 'text-expense'}`}
              fractionClassName="type-amount-sm"
            />
          )}
          <Typography type="body-xs" color="muted">
            {candidate.currency !== null && candidate.currency !== 'INR' ? `${candidate.currency} · ${when}` : when}
          </Typography>
        </View>
      </Pressable>

      {onConfirm !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Confirm ${candidate.item}`}
          hitSlop={6}
          onPress={onConfirm}
          className="size-10 items-center justify-center rounded-full bg-surface active:opacity-60">
          <Icon icon={Check} color="accent" size={18} />
        </Pressable>
      ) : (
        <View className="w-2" />
      )}
    </View>
  );
}

export const CandidateRow = memo(CandidateRowBase);
