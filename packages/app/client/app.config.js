module.exports = ({ config }) => ({
    ...config,
    experiments: {
        ...config.experiments,
        ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
    },
});
