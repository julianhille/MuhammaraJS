// Jest loads modules through its own registry, which Node's require.cache does
// not reach. These tests load the package the way Jest users do.
// Jest cannot require ES modules yet, so the ESM-only linebreak and unicode-trie
// packages are compiled to CommonJS on the way in.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/*.test.js"],
  transform: {
    "/node_modules/(linebreak|unicode-trie)/.+\\.js$": [
      "babel-jest",
      { plugins: ["@babel/plugin-transform-modules-commonjs"] },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(linebreak|unicode-trie)/)"],
};
