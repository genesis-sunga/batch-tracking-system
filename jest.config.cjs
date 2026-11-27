module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
};
