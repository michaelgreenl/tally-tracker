import { requireOptionalNativeModule } from 'expo';

import type { WidgetBridge } from './widget-bridge';

// An older development build can still open the app before its widget extension is installed.
export const widgetBridge = requireOptionalNativeModule<WidgetBridge>('TallyWidgets');
