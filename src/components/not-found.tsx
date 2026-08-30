import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { Button } from './button';
import { SafeAreaView } from './safe-area-view';

export type NotFoundProps = {
  title: string;
  description: string;
};

/**
 * A record that is not there.
 *
 * Four detail routes had a near-identical hand-rolled version of this. They also
 * had it as an early return *above* their hooks, which was safe only while the
 * lookup was a synchronous fixture read — the moment it became a query that
 * flips from null to a row, the hook count changed between renders. Every caller
 * now renders this from the bottom of the component, with all hooks above.
 */
export function NotFound({ title, description }: NotFoundProps) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Typography type="h4" weight="semibold">
        {title}
      </Typography>
      <Typography type="body-sm" color="muted" className="text-center">
        {description}
      </Typography>
      <View className="pt-2">
        <Button label="Go back" tone="secondary" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
