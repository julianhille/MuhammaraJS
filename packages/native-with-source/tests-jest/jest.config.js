// Jest loads modules through its own registry, which Node's require.cache does
// not reach. These tests load the package the way Jest users do.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/*.test.js"],
};
