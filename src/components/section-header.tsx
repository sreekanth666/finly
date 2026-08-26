import { Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export type SectionHeaderProps = {
  label: string;
  /** Right-hand slot — a count, or a pressable action such as "See more". */
  trailing?: ReactNode;
};

/**
 * The label-left / action-right row that introduces a group on the feed
 * screens. Shared so Transactions and Rules keep the same rhythm.
 */
export function SectionHeader({ label, trailing }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-1">
      <Typography type="body-sm" color="muted">
        {label}
      </Typography>
      {trailing}
    </View>
  );
}
