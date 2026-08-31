/**
 * The name the app calls someone by.
 *
 * §1 is explicit that there is no account and no user table, and that has not
 * changed: this is one string in the settings key/value table, held so the app
 * can address the person using it rather than to identify them.
 */

/** How many letters the avatar shows. Three is a monogram; one is a mystery. */
const MAX_INITIALS = 2;

const MORNING_ENDS_AT = 12;
const AFTERNOON_ENDS_AT = 17;

/**
 * A monogram for the header avatar, or null when the name yields no letters.
 *
 * Null rather than a fallback like '?': the caller shows a neutral glyph for an
 * unset name anyway, and inventing a placeholder here would make an empty name
 * and a nameless one render differently for no reason.
 */
export function initialsOf(name: string): string | null {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_INITIALS)
    /* Split to code points before taking the first: `word[0]` returns a code
       unit, which is half a surrogate pair for anything outside the BMP. */
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('');

  return letters.length > 0 ? letters : null;
}

/**
 * Time of day, as an address rather than a fact.
 *
 * The clock is a defaulted parameter so the domain stays pure and a test can
 * name the hour it means.
 */
export function greetingFor(now: number = Date.now()): string {
  const hour = new Date(now).getHours();
  if (hour < MORNING_ENDS_AT) return 'Good morning';
  if (hour < AFTERNOON_ENDS_AT) return 'Good afternoon';
  return 'Good evening';
}
