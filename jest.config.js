module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!test/**',
    '!**/*.module.ts',
    '!main.ts',
    '!**/index.ts',
    '!**/*.dto.ts',
    '!**/dtos/**',
    '!**/scripts/**',
    '!**/*.d.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      statements: 60,
      lines: 60,
      functions: 60,
      branches: 60,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};