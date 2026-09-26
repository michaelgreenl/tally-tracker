const { withAppDelegate } = require('expo/config-plugins');

// Preserve Expo deep links while forwarding Google's callback to its native SDK.
module.exports = (config) =>
    withAppDelegate(config, (config) => {
        const delegate = config.modResults;
        const handler = 'GIDSignIn.sharedInstance.handle(url)';
        if (delegate.contents.includes(handler)) return config;

        const anchor = 'return super.application(app, open: url, options: options)';
        if (delegate.language !== 'swift' || !delegate.contents.includes(anchor)) {
            throw new Error('Google sign-in: review the AppDelegate URL handler before building.');
        }
        delegate.contents = `import GoogleSignIn\n${delegate.contents.replace(anchor, `return ${handler} || super.application(app, open: url, options: options)`)}`;
        return config;
    });
