module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/node_modules/@actions/core/lib/core.js'
  },
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}