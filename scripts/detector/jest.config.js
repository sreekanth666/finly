/**
 * Runs the detector trainer (D21) through jest, which already compiles the
 * domain with its `@/` paths — so the trainer uses exactly the feature code
 * the app ships, with no build step and no new dependency. The main config
 * never matches this file, so `pnpm test` never trains.
 *
 * Run: pnpm train:detector
 */
process.env.TZ = process.env.TZ ?? 'Asia/Kolkata';

module.exports = {
  rootDir: '../..',
  preset: 'jest-expo/node',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/scripts/detector/train.run.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 600_000,
};
