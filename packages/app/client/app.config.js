module.exports = ({ config }) => ({
    ...config,
    ios: {
        ...config.ios,
        entitlements: {
            ...config.ios?.entitlements,
            'com.apple.security.application-groups': ['group.com.tallytracker.app'],
        },
    },
    plugins: [
        ...(config.plugins || []),
        '@bacons/apple-targets',
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
