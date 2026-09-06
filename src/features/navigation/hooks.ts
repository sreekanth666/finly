import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { createSubmitLatch } from '@/db/submit-latch';

/**
 * `router.push`, once per press.
 *
 * A push is not instant: the destination has to mount and the stack has to
 * animate, and for those few hundred milliseconds the row that was tapped is
 * still on screen and still taking touches. A second tap pushes the same route
 * again, so the user arrives on two stacked copies of Settings and has to go
 * back twice to leave one screen.
 *
 * The latch is the same one the write guards use, with the opposite lifetime.
 * A save that succeeded is final — the screen is leaving and must never save
 * again. A navigation is only final until the user comes back, so this releases
 * on focus. Going to Settings, returning, and going again is not a double tap;
 * it is two journeys, and both have to work.
 */
export function useNavigateOnce(): (href: Href) => void {
  const [latch] = useState(createSubmitLatch);

  useFocusEffect(
    useCallback(() => {
      /* Fires on the way in, including the first time. Re-arming on focus
         rather than on blur means an interrupted push — a destination that
         never mounted — does not leave the button dead. */
      latch.reset();
    }, [latch]),
  );

  return (href: Href) => {
    void latch.run(() => {
      router.push(href);
      return true;
    });
  };
}
