module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/infrastructure/cdk'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
