import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { House, Repeat, SlidersHorizontal, Sparkle, type LucideIcon } from 'lucide-react-native';
import type { Href } from 'expo-router';
import { View } from 'react-native';

import { TabBarSurface, TabItem } from '@/components/tab-bar';

type TabDefinition = {
  name: string;
  href: Href;
  label: string;
  icon: LucideIcon;
};

const TABS: TabDefinition[] = [
  { name: 'index', href: '/', label: 'Balance', icon: House },
  { name: 'transactions', href: '/transactions', label: 'Transactions', icon: Repeat },
  { name: 'rules', href: '/rules', label: 'Rules', icon: SlidersHorizontal },
  { name: 'insights', href: '/insights', label: 'Insights', icon: Sparkle },
];

/**
 * Headless tabs — the bar is fully custom, so this skips the default bottom-tab
 * chrome. The triggers live here rather than inside a bar component because
 * expo-router discovers routes by walking this element tree.
 */
export default function TabsLayout() {
  return (
    <View className="flex-1 bg-background">
      <Tabs style={{ flex: 1 }}>
        <TabSlot />
        <TabList asChild>
          <TabBarSurface>
            {TABS.map(({ name, href, label, icon }) => (
              <TabTrigger key={name} name={name} href={href} asChild>
                <TabItem icon={icon} label={label} />
              </TabTrigger>
            ))}
          </TabBarSurface>
        </TabList>
      </Tabs>
    </View>
  );
}
