import { defineConfig } from 'drizzle-kit';

/**
 * `out` is the repo root rather than somewhere under src/ on purpose: the
 * generated files are checked in, and scripts/check-colors.mjs only scans src/.
 * Generated SQL has no business failing a hand-written-code lint.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
