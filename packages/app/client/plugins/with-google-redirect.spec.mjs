import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const withGoogleRedirect = require('./with-google-redirect');
const original = `import Expo
public override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
  return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
}`;

async function apply(contents) {
    const config = withGoogleRedirect({ name: 'Tally', slug: 'tally-tracker' });
    const result = await config.mods.ios.appDelegate({
        ...config,
        modResults: { language: 'swift', path: 'AppDelegate.swift', contents },
        modRequest: {
            projectRoot: '',
            platformProjectRoot: '',
            projectName: 'Tally',
            platform: 'ios',
            modName: 'appDelegate',
            introspect: false,
            ignoreExistingNativeFiles: false,
        },
    });
    return result.modResults.contents;
}

it('forwards Google callbacks before Expo deep links and remains stable across rebuilds', async () => {
    const updated = await apply(original);
    expect(updated).toContain(
        'return GIDSignIn.sharedInstance.handle(url) || super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)',
    );
    expect(updated).toContain('import GoogleSignIn');
    expect(await apply(updated)).toBe(updated);
});

it('stops a build when a changed native template would leave Google redirects unhandled', async () => {
    await expect(apply('import Expo')).rejects.toThrow();
});
