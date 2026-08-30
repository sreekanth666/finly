import { Typography } from 'heroui-native';
import { RotateCw, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from './button';
import { Icon } from './icon';

import { RepositoryError } from '@/db/errors';

export type ErrorStateProps = {
  error: Error;
  onRetry?: () => void;
};

/**
 * What a screen shows when a query fails.
 *
 * A `RepositoryError` was raised deliberately and carries a sentence written for
 * the user; anything else is a surprise, and saying so plainly beats showing
 * them a stack trace or, worse, an empty list that looks like they have no data.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message =
    error instanceof RepositoryError
      ? error.userMessage
      : 'Something went wrong reading your data.';

  return (
    <View className="items-center gap-2 px-8 py-16">
      <Icon icon={TriangleAlert} color="danger" size={28} />
      <Typography type="body" weight="medium" className="pt-1">
        {message}
      </Typography>
      <Typography type="body-xs" color="muted" className="text-center">
        {error.message}
      </Typography>
      {onRetry && (
        <View className="pt-3">
          <Button label="Try again" icon={RotateCw} tone="secondary" size="sm" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
