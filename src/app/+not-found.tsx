import { router, Stack } from 'expo-router';
import { Typography } from 'heroui-native';
import { Compass } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';

/**
 * expo-router's catch-all, for a path that matches no route.
 *
 * Distinct from `components/not-found.tsx`, which is for a *record* that no
 * longer exists — a deleted expense reached from a stale screen. This one is for
 * a bad deep link or a typo'd route, and without it the user drops out of the
 * app's own chrome onto the framework's stock unmatched-route screen.
 */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background px-8">
        <Icon icon={Compass} color="muted" size={28} />
        <Typography type="h4" weight="semibold">
          There is nothing here
        </Typography>
        <Typography type="body-sm" color="muted" className="text-center">
          That link does not point anywhere in Finly.
        </Typography>
        <View className="pt-2">
          <Button label="Go to Balance" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    </>
  );
}
