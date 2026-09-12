/**
 * A message with the private parts scrambled, for "this wasn't read correctly".
 *
 * The owner shares a misread message so it can join the test corpus. What it
 * needs to keep is its *shape* — where the amount sits, how the date is
 * written, how long the reference is — and what it must lose is anything that
 * identifies a person or an account. So:
 *
 * - long digit runs (references, phone numbers) keep their length but not their
 *   digits; amounts are left alone, since the amount is usually what went wrong;
 * - card and account tails are scrambled the same way;
 * - the local part of a UPI id and the name after "Dear" become placeholders.
 *
 * Names elsewhere cannot be told from merchants, so the screen shows the result
 * in an editable box before anything is copied.
 */

const scramble = (digits: string) => digits.replace(/\d/g, (digit) => String((Number(digit) * 7 + 3) % 10));

export function maskMessage(body: string): string {
  return body
    .replace(/\b(Dear|Hi|Hello)\s+(?!customer\b|sir\b|madam\b|user\b|upi\b|sbi\b)[A-Z][A-Za-z]*/gi, '$1 NAME')
    .replace(/\b[\w.-]+@([a-z][\w.-]*)/gi, 'name@$1')
    .replace(/([X*]{1,}|\bending(?:\s+(?:with|in))?\s+)(\d{3,5})\b/gi, (_, prefix: string, digits: string) =>
      `${prefix}${scramble(digits)}`,
    )
    .replace(/\d{6,}/g, (run, offset: number, whole: string) => {
      const before = whole.slice(Math.max(0, offset - 5), offset);
      const after = whole.slice(offset + run.length, offset + run.length + 3);
      if (/(?:rs\.?|inr|₹)\s*$/i.test(before) || /^\.\d/.test(after)) return run;
      return scramble(run);
    });
}
