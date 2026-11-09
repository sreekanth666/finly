import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type ExpoTabsScreenOptions,
  type UseTabsOptions,
} from 'expo-router/ui';
import {
  ArrowLeftRight,
  ChartColumn,
  House,
  Plus,
  Settings,
  type LucideIcon,
} from '@/components/icons';
import type { Href } from 'expo-router';
import { View } from 'react-native';

import { AddButton, BarLink, FloatingTabBar, TabIcon } from '@/components/tab-bar';
import { useNavigateOnce } from '@/features/navigation/hooks';

/**
 * Contains a crash to the tabs rather than the whole app.
 *
 * The root layout exports one too, but a boundary only catches what is *below*
 * it — so without this, a render throw in Insights replaced the entire app,
 * navigation and all, and the user's only way back was to force-quit.
 */
export { ErrorBoundary } from 'expo-router';

type TabDefinition = {
  name: string;
  href: Href;
  label: string;
  icon: LucideIcon;
};

const HOME: TabDefinition = { name: 'index', href: '/', label: 'Home', icon: House };
const TRANSACTIONS: TabDefinition = {
  name: 'transactions',
  href: '/transactions',
  label: 'Transactions',
  icon: ArrowLeftRight,
};
const INSIGHTS: TabDefinition = {
  name: 'insights',
  href: '/insights',
  label: 'Insights',
  icon: ChartColumn,
};

/**
 * A tab stays mounted once visited — TabSlot is lazy, not unmount-on-blur — so
 * its live queries keep answering every write. Freezing a hidden tab holds
 * those renders until it is shown again, instead of re-rendering three screens
 * nobody can see.
 *
 * The cast is for expo-router's types, which require `title` and `action` on
 * screen options; nothing reads those from here, and the merge into each tab's
 * options only needs the one field.
 */
const TAB_OPTIONS: UseTabsOptions = {
  screenOptions: { freezeOnBlur: true } as ExpoTabsScreenOptions,
};

const renderTab = ({ name, href, label, icon }: TabDefinition) => (
  <TabTrigger key={name} name={name} href={href} asChild>
    <TabIcon icon={icon} label={label} />
  </TabTrigger>
);

/**
 * Headless tabs — the bar is fully custom, so this skips the default bottom-tab
 * chrome. The triggers live here rather than inside a bar component because
 * expo-router discovers routes by walking this element tree. That walk only
 * collects `TabTrigger`s and ignores everything else, so the add and Settings
 * buttons sit in the same list, between the tabs, without being routes.
 *
 * The slot fills the screen and the bar floats over it; every tab's scroller
 * reserves room for the pill with `useFloatingBarClearance`.
 */
export default function TabsLayout() {
  /* One push per press: the button stays tappable for the whole transition. */
  const navigate = useNavigateOnce();

  return (
    <View className="flex-1 bg-background">
      <Tabs style={{ flex: 1 }} options={TAB_OPTIONS}>
        <TabSlot />
        <TabList asChild>
          <FloatingTabBar>
            {renderTab(HOME)}
            {renderTab(TRANSACTIONS)}
            <AddButton icon={Plus} label="Add expense" onPress={() => navigate('/expense/new')} />
            {renderTab(INSIGHTS)}
            <BarLink icon={Settings} label="Settings" onPress={() => navigate('/settings')} />
          </FloatingTabBar>
        </TabList>
      </Tabs>
    </View>
  );
}
