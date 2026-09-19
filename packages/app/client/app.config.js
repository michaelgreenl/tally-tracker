module.exports = ({ config }) => ({
    ...config,
    plugins: [
        ...(config.plugins || []),
        ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
            ? [
                  [
                      'react-native-nitro-google-signin',
                      {
                          iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.'),
                      },
                  ],
                  './plugins/with-google-redirect',
              ]
            : []),
    ],
    experiments: {
        ...config.experiments,
        ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
    },
});
