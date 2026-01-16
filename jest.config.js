module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
