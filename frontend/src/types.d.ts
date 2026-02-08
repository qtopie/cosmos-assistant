export {};

type GeminiAttachment = {
    name: string;
    content: string;
    isBinary: boolean;
};

declare global {
    interface Window {
        go: {
            main: {
                App: {
                    About(): Promise<string>;
                    ChatWithGemini(arg1: string): Promise<string>;
                    ChatWithGeminiWithAttachments(arg1: string, arg2: GeminiAttachment[]): Promise<string>;
                    InstallVlink(arg1: string, arg2: string): Promise<string>;
                    IsVlinkInstalled(): Promise<boolean>;
                    IsVlinkPortAlive(): Promise<boolean>;
                    SelfUpdate(): Promise<string>;
                    StartVlink(): Promise<string>;
                    StopVlink(): Promise<string>;
                };
            };
        };
    }
}
