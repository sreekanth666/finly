import { Typography } from 'heroui-native';
import { LayoutTemplate, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

export type RuleTemplatesBannerProps = {
  /** Templates not yet among the user's rules. */
  availableCount: number;
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * The way into rule templates, at the top of the Rules list.
 *
 * Filled with the accent on purpose. Everything else on this tab is a grey
 * card, and a way in that looks like one more of them is a way in nobody
 * finds — the point of templates is to be seen by someone who doesn't know
 * yet what a rule should look like. Once closed, a plain "Templates" button
 * beside "New" takes over, so dismissing it never loses them.
 */
export function RuleTemplatesBanner({ availableCount, onOpen, onDismiss }: RuleTemplatesBannerProps) {
  const count =
    availableCount === 1 ? '1 ready-made rule' : `${availableCount} ready-made rules`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start from a template. ${count}.`}
      onPress={onOpen}
      className="flex-row items-center gap-3 rounded-3xl bg-accent p-4 active:opacity-80">
      <View className="size-11 items-center justify-center rounded-2xl bg-accent-foreground">
        <Icon icon={LayoutTemplate} color="accent" size={20} />
      </View>

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="semibold" className="text-accent-foreground">
          Start from a template
        </Typography>
        <Typography type="body-xs" className="text-accent-foreground">
          {`${count} for Swiggy, Uber, Amazon, Starbucks and more — see how each one is built.`}
        </Typography>
      </View>

      {/* Its own target, so closing the banner never also opens the sheet. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide templates banner"
        hitSlop={10}
        onPress={onDismiss}
        className="size-7 self-start items-center justify-center rounded-full active:opacity-60">
        <Icon icon={X} color="accent-foreground" size={16} />
      </Pressable>
    </Pressable>
  );
}
