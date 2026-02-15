export {};

type GeminiAttachment = {
    name: string;
    content: string;
    isBinary: boolean;
};

type AppSettings = {
    displayName: string;
    autoUpdate: boolean;
    vlinkAutoStart: boolean;
    notes: string;
    pomodoroNotifyDesktop: boolean;
    pomodoroNotifySound: boolean;
};

type VlinkConfig = {
    path: string;
    content: string;
};

declare global {
    interface Window {
        go: {
            main: {
                App: {
                    About(): Promise<string>;
                    ChatWithGemini(arg1: string): Promise<string>;
                    ChatWithGeminiWithAttachments(arg1: string, arg2: GeminiAttachment[]): Promise<string>;
                    GetSettings(): Promise<AppSettings>;
                    GetVlinkConfig(): Promise<VlinkConfig>;
                    InstallVlink(arg1: string, arg2: string): Promise<string>;
                    IsVlinkInstalled(): Promise<boolean>;
                    IsVlinkPortAlive(): Promise<boolean>;
                    SaveVlinkConfig(arg1: string): Promise<string>;
                    SaveSettings(arg1: AppSettings): Promise<string>;
                    SelfUpdate(): Promise<string>;
                    StartVlink(): Promise<string>;
                    StopVlink(): Promise<string>;
                };
            };
        };
    }
}
