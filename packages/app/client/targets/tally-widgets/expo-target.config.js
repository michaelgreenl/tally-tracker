module.exports = {
    type: 'widget',
    name: 'TallyWidgets',
    displayName: 'Tally',
    bundleIdentifier: '.widgets',
    deploymentTarget: '17.0',
    entitlements: {}, // Inherit the main app's App Group.
    frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
    colors: {
        $accent: '#70c8e3',
        $widgetBackground: '#25292e',
    },
};
