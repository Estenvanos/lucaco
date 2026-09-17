import type { Config } from "jest";

/**
 * ESM + TypeScript: ts-jest transpiles, and Node runs the result as real ESM
 * (npm test sets --experimental-vm-modules, which Jest needs for ESM).
 */
const config: Config = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { useESM: true }] },
  // Source imports carry the .js extension (ESM), but the files on disk are .ts.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
};

export default config;
