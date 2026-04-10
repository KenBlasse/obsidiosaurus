/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^config$': '<rootDir>/config.ts',
    '^main$': '<rootDir>/__mocks__/main.ts',
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
