import { Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type PlaceholderScreenProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Stand-in for screens that haven't been designed yet. */
export function PlaceholderScreen({ title, description, children }: PlaceholderScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 gap-2 px-5 pt-2">
        <Typography type="h2">{title}</Typography>
        <Typography type="body-sm" color="muted">
          {description}
        </Typography>
        {children}
      </View>
    </SafeAreaView>
  );
}
