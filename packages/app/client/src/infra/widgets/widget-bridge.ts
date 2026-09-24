export type WidgetBridge = {
    pending(): string;
    publish(owner: string, counters: string, applied: string[]): void;
    acknowledge(ids: string[]): void;
    hide(): void;
    removeAccount(owner: string): void;
};

// Android and web keep the existing counter storage and UI.
export const widgetBridge: WidgetBridge | null = null;
