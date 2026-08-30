/**
 * The suite covers src/domain/ only — the pure layer, where the correctness risk
 * actually lives (§8). It deliberately does not reach src/db/: expo-sqlite is a
 * native module with no Node build, so anything importing it cannot run here.
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
  testMatch: ['<rootDir>/src/domain/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};
