module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {syntax: 'typescript'},
          target: 'es2022'
        },
        module: {type: 'commonjs'}
      }
    ]
  },
  verbose: true
}