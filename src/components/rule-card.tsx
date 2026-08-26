import { Switch, Typography } from 'heroui-native';
import { CircleSlash2, Wallet, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import { CATEGORIES } from '@/data/categories';
import { OPERATOR_LABELS, type Rule, type RuleAction, type RuleCondition } from '@/data/rules';
import type { AppColor } from '@/theme';

export type RuleCardProps = {
  rule: Rule;
  /**
   * Position in the evaluation order, or null for a paused rule — a rule that
   * never runs has no place in the order, and saying so beats showing a number
   * that means nothing.
   */
  rank: number | null;
  onToggle: (isEnabled: boolean) => void;
  onPress?: () => void;
};

/** Reads as a sentence: `item contains "swiggy"`. */
const describeCondition = ({ field, operator, value }: RuleCondition) =>
  `${field} ${OPERATOR_LABELS[operator]} "${value}"`;

const describeUsage = (timesApplied: number) => {
  if (timesApplied === 0) return 'Not used yet';

  return `Used ${timesApplied} ${timesApplied === 1 ? 'time' : 'times'}`;
};

type ActionPillProps = { icon: LucideIcon; tone: AppColor; label: string };

const toActionPill = (action: RuleAction): ActionPillProps => {
  switch (action.type) {
    case 'set_category': {
      const category = CATEGORIES[action.categoryId];

      return { icon: category.icon, tone: category.tone, label: category.label };
    }
    case 'set_account':
      return { icon: Wallet, tone: 'muted', label: action.label };
    case 'set_counts_to_budget':
      return action.countsToBudget
        ? { icon: Wallet, tone: 'muted', label: 'Counts to budget' }
        : { icon: CircleSlash2, tone: 'warning', label: 'Off budget' };
  }
};

function ActionPill({ icon, tone, label }: ActionPillProps) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-surface-secondary px-2.5 py-1">
      <Icon icon={icon} color={tone} size={12} />
      <Typography type="body-xs">{label}</Typography>
    </View>
  );
}

/**
 * One rule: its place in the evaluation order, what it matches, what it fills
 * in, and how often it has earned its keep.
 */
export function RuleCard({ rule, rank, onToggle, onPress }: RuleCardProps) {
  const { name, isEnabled, matchMode, conditions, actions, timesApplied } = rule;
  const conditionText = conditions
    .map(describeCondition)
    .join(matchMode === 'all' ? ' and ' : ' or ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-3 rounded-3xl bg-surface p-4 active:opacity-60">
      <View className="flex-row items-center gap-3">
        <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
          <Typography
            type="body-sm"
            weight="semibold"
            className={rank === null ? 'text-muted' : 'text-foreground'}>
            {rank === null ? '—' : rank}
          </Typography>
        </View>

        <View className="flex-1 gap-0.5">
          <Typography type="body-sm" weight="semibold" truncate>
            {name}
          </Typography>
          <Typography type="body-xs" color="muted" truncate>
            {conditionText}
          </Typography>
        </View>

        <Switch
          isSelected={isEnabled}
          onSelectedChange={onToggle}
          accessibilityLabel={`Enable ${name}`}
        />
      </View>

      <View className="flex-row items-center justify-between gap-3 border-t border-border pt-3">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          {actions.map((action) => {
            const pill = toActionPill(action);

            return <ActionPill key={`${action.type}-${pill.label}`} {...pill} />;
          })}
        </View>

        <Typography type="body-xs" color="muted">
          {describeUsage(timesApplied)}
        </Typography>
      </View>
    </Pressable>
  );
}
