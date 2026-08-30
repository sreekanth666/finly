import { Typography } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from './button';
import { Icon } from './icon';

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; icon?: LucideIcon; onPress: () => void };
};

/**
 * Shared empty state.
 *
 * "Nothing here yet" and "nothing matches this filter" are different situations
 * and want different copy — the first invites you to add something, the second
 * to widen the filter. Callers pass both, which is why this takes a description
 * rather than deriving one.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      {icon && <Icon icon={icon} color="muted" size={28} />}
      <Typography type="body" weight="medium" className="pt-1">
        {title}
      </Typography>
      <Typography type="body-sm" color="muted" className="text-center">
        {description}
      </Typography>
      {action && (
        <View className="pt-3">
          <Button label={action.label} icon={action.icon} tone="secondary" size="sm" onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}
