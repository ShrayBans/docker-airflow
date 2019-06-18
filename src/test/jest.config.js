module.exports = {
    collectCoverageFrom: ["src/**/*.{js,ts}"],
    coverageDirectory: "coverage",
    setupTestFrameworkScriptFile: require.resolve("./setupTests"),
    testMatch: [
        "<rootDir>/**/?(*.)(spec|test).(js|ts)?(x)",
    ],
    reporters: process.env.CI ? undefined : ["jest-spec-reporter"],
    rootDir: "../",
    moduleFileExtensions: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node",
    ],
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    testEnvironment: "node",
};