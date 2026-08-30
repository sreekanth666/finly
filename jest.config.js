/**
 * Two suites.
 *
 * src/domain/ is the pure layer, where most of the correctness risk lives (§8).
 *
 * src/db/ covers the SQL contract — constraints, aggregates, cascades — by
 * applying the *generated* migration to Node's built-in `node:sqlite`. It cannot
 * import the repositories themselves, because those reach expo-sqlite, which is
 * native and has no Node build; but the invariants §8 names are all expressible
 * in SQL, and this is what turns the checks that were being run by hand each
 * milestone into a gate.
 *
 * TZ is set at module load rather than in setupFiles. Node caches the zone the
 * first time a Date is constructed, and by the time setup files run that has
 * already happened — the period tests would then silently assert against
 * whatever zone the machine happens to be in.
 */
process.env.TZ = process.env.TZ ?? 'Asia/Kolkata';

module.exports = {
  preset: 'jest-expo/node',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/domain/__tests__/**/*.test.ts',
    '<rootDir>/src/db/__tests__/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};
