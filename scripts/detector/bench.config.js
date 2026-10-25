/**
 * Runs the detector benchmark (D21) on an outside dataset through jest, which
 * already compiles the domain with its `@/` paths — so the benchmark reads
 * messages with exactly the code the app ships, with no build step and no new
 * dependency. The main config never matches this file, so `pnpm test` never
 * reads a dataset.
 *
 * Run: pnpm detector:bench <file.csv>
 */
process.env.TZ = process.env.TZ ?? 'Asia/Kolkata';

module.exports = {
  rootDir: '../..',
  preset: 'jest-expo/node',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/scripts/detector/bench.run.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 600_000,
};
