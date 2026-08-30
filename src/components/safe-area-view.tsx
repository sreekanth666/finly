import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

/**
 * `SafeAreaView` with `className` wired up.
 *
 * Uniwind does not rewrite `className` at the JSX level. It swaps React
 * Native's own components for its own through a Metro resolver, and everything
 * else has to be registered with `withUniwind` — otherwise `className` is
 * handed to the component as an ordinary prop and quietly dropped.
 *
 * react-native-safe-area-context's `SafeAreaView` forwards its props to a
 * codegen'd host view, so `className="flex-1 bg-background"` on it was doing
 * nothing at all: every screen's root container sized itself to its content
 * instead of filling the window. Where the screen had a footer below a
 * `flex-1` ScrollView the scroll area then collapsed to zero height, which is
 * how onboarding came out as a header with the buttons directly underneath and
 * the step's content nowhere to be seen.
 *
 * Import this everywhere instead of the upstream component.
 */
export const SafeAreaView = withUniwind(NativeSafeAreaView);
