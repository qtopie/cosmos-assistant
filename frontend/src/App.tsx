import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    FluentProvider,
    webDarkTheme,
    webLightTheme,
    Button,
    Caption1,
    Body1,
    Input,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    ToggleButton,
    Badge,
    Spinner,
} from '@fluentui/react-components';
import { Home24Regular } from '@fluentui/react-icons';
import MonacoEditor from '@monaco-editor/react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import Dashboard from './pages/Dashboard';
import WorkBoard from './pages/WorkBoard';
import ArticleEditor from './pages/ArticleEditor';
import Pomodoro from './pages/Pomodoro';
import { ChatMessage } from './components/ChatPanel';
import { TodoItem } from './components/TodoList';
import Settings, { AppSettings } from './pages/Settings';

type GeminiAttachment = {
    name: string;
    content: string;
    isBinary: boolean;
};

const metrics = [
    { label: '活跃技能', value: '32', trend: '+6%' },
    { label: '今日任务', value: '14', trend: '+2' },
    { label: '自动化执行', value: '68%', trend: '+4%' },
    { label: '风险拦截', value: '3', trend: '需确认' },
];

const quickActions = ['生成周报', '同步 IoT 状态', '复盘执行日志', '打开场景配置'];

const activityFeed = [
    { time: '09:12', text: '完成“专注办公”场景启动' },
    { time: '09:18', text: '检测到 2 个设备离线，已通知' },
    { time: '09:34', text: '生成销售看板草稿，待确认' },
    { time: '09:40', text: '自动化清理 4 个重复任务' },
];

const starterMessages: ChatMessage[] = [
    { role: 'assistant', content: '早上好！我可以帮你准备今日计划。' },
    { role: 'assistant', content: '是否要打开“专注办公”场景并同步设备状态？' },
];

const starterTodos: TodoItem[] = [
    {
        id: 'task-1',
        title: '整理新客户画像与目标清单',
        owner: '星络',
        due: '2026-02-10',
        tag: '增长',
        status: 'todo',
        start: '2026-02-09',
        end: '2026-02-11',
    },
    {
        id: 'task-2',
        title: '复盘自动化告警与响应链路',
        owner: '联枢',
        due: '2026-02-11',
        tag: '稳定性',
        status: 'doing',
        start: '2026-02-10',
        end: '2026-02-12',
    },
    {
        id: 'task-3',
        title: '输出商业报表生成策略',
        owner: '析者',
        due: '2026-02-12',
        tag: '报表',
        status: 'doing',
        start: '2026-02-11',
        end: '2026-02-14',
    },
    {
        id: 'task-4',
        title: '同步 IoT 设备巡检计划',
        owner: '守望',
        due: '2026-02-13',
        tag: '设备',
        status: 'todo',
        start: '2026-02-12',
        end: '2026-02-15',
    },
    {
        id: 'task-5',
        title: '确认跨部门排期与资源冲突',
        owner: '协调组',
        due: '2026-02-14',
        tag: '协同',
        status: 'todo',
        start: '2026-02-13',
        end: '2026-02-16',
    },
    {
        id: 'task-6',
        title: '归档已完成的情报回收清单',
        owner: '归档',
        due: '2026-02-09',
        tag: '归档',
        status: 'done',
        start: '2026-02-08',
        end: '2026-02-09',
    },
];

const isLikelyTextFile = (file: File) => {
    if (file.type && file.type.startsWith('text/')) return true;
    const name = file.name.toLowerCase();
    return (
        name.endsWith('.txt') ||
        name.endsWith('.md') ||
        name.endsWith('.json') ||
        name.endsWith('.csv') ||
        name.endsWith('.yaml') ||
        name.endsWith('.yml') ||
        name.endsWith('.log')
    );
};

const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsText(file);
    });

const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });

const prepareAttachments = async (files: File[]): Promise<GeminiAttachment[]> => {
    const prepared = await Promise.all(
        files.map(async (file) => {
            const isText = isLikelyTextFile(file);
            const content = isText ? await readFileAsText(file) : await readFileAsBase64(file);
            return {
                name: file.name,
                content: String(content || ''),
                isBinary: !isText,
            };
        })
    );
    return prepared.filter((item) => item.content.trim() !== '');
};

export default function App() {
    const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
    const [inputValue, setInputValue] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
    const [isProxyEnabled, setIsProxyEnabled] = useState(false);
    const [vlinkStatus, setVlinkStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [installViewActive, setInstallViewActive] = useState(false);
    const [installMessage, setInstallMessage] = useState('准备开始…');

    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutText, setAboutText] = useState('');

    const [updateOpen, setUpdateOpen] = useState(false);
    const [updateInProgress, setUpdateInProgress] = useState(false);
    const [updateResult, setUpdateResult] = useState('');

    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return true;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [vlinkPassword, setVlinkPassword] = useState('');
    const [installResolve, setInstallResolve] = useState<
        ((result: { confirmed: boolean; password: string }) => void) | null
    >(null);
    const [vlinkConfigOpen, setVlinkConfigOpen] = useState(false);
    const [vlinkConfigDraft, setVlinkConfigDraft] = useState('');
    const [vlinkConfigPath, setVlinkConfigPath] = useState('');
    const [vlinkConfigError, setVlinkConfigError] = useState('');
    const [vlinkConfigSaving, setVlinkConfigSaving] = useState(false);
    const [pendingVlinkStart, setPendingVlinkStart] = useState(false);
    const isWindows = useMemo(
        () => typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent),
        []
    );

    const [activeView, setActiveView] = useState<'home' | 'settings' | 'board' | 'editor' | 'pomodoro'>('home');
    const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null);
    const [settingsError, setSettingsError] = useState('');
    const [todos, setTodos] = useState<TodoItem[]>(starterTodos);
    const [articleDraft, setArticleDraft] = useState(
        '# 今日协同计划\n\n- 目标一：统一跨部门排期\n- 目标二：完善自动化告警\n\n## 关键动作\n\n1. 明确责任人\n2. 完成风险评估\n3. 输出复盘清单\n\n> 支持 **Markdown** 与任务清单。\n'
    );

    const fallbackSettings: AppSettings = {
        displayName: 'Domour Copilot',
        autoUpdate: true,
        vlinkAutoStart: false,
        notes: '',
        pomodoroNotifyDesktop: true,
        pomodoroNotifySound: false,
    };

    const currentSettings = settingsDraft ?? fallbackSettings;

    const chatBodyRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const vlinkTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    const loadSettings = async () => {
        try {
            const current = await window.go.main.App.GetSettings();
            setSettingsDraft({ ...fallbackSettings, ...current });
        } catch {
            setSettingsError('设置加载失败');
        }
    };

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (event: MediaQueryListEvent) => setIsDarkMode(event.matches);

        setIsDarkMode(media.matches);
        if (media.addEventListener) {
            media.addEventListener('change', handleChange);
        } else {
            media.addListener(handleChange);
        }

        return () => {
            if (media.addEventListener) {
                media.removeEventListener('change', handleChange);
            } else {
                media.removeListener(handleChange);
            }
        };
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        EventsOn('vlink:install', (message: string) => {
            setInstallMessage(message || '-');
            if (message && message.includes('安装完成')) {
                window.setTimeout(() => {
                    setInstallViewActive(false);
                }, 800);
            }
        });

        EventsOn('vlink:config', (payload: { path?: string; content?: string }) => {
            setVlinkConfigError('');
            setVlinkConfigPath(payload?.path ?? '');
            setVlinkConfigDraft(payload?.content ?? '');
            setVlinkConfigOpen(true);
            setPendingVlinkStart(true);
        });

        EventsOn('menu:about', async () => {
            try {
                const info = await window.go.main.App.About();
                setAboutText(info || '');
            } catch {
                setAboutText('获取信息失败');
            }
            setAboutOpen(true);
        });

        EventsOn('menu:update', () => {
            setUpdateResult('');
            setUpdateInProgress(false);
            setUpdateOpen(true);
        });

        EventsOn('menu:settings', async () => {
            setSettingsError('');
            await loadSettings();
            setActiveView('settings');
        });

        loadSettings();
    }, []);

    const handleNewSession = () => {
        setMessages(starterMessages);
        setPendingAttachments([]);
        setInputValue('');
    };

    const handleSend = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed && pendingAttachments.length === 0) return;

        const userText = trimmed || '（仅附件）';
        const assistantId = `assistant-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { role: 'user', content: userText },
            { role: 'assistant', content: '处理中…', id: assistantId },
        ]);
        setInputValue('');

        const filesToSend = pendingAttachments;
        setPendingAttachments([]);

        try {
            const attachments = await prepareAttachments(filesToSend);
            const prompt = trimmed || '请根据附件内容进行分析。';
            const response = attachments.length
                ? await window.go.main.App.ChatWithGeminiWithAttachments(prompt, attachments)
                : await window.go.main.App.ChatWithGemini(prompt);
            setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: response || '（无返回）' } : msg))
            );
        } catch (error) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantId
                        ? { ...msg, content: '调用 Gemini CLI 失败，请检查命令或环境配置。' }
                        : msg
                )
            );
        }
    };

    const handleAttachFiles = (files: File[]) => {
        if (!files || files.length === 0) return;
        setPendingAttachments((prev) => [...prev, ...files]);
    };

    const removeAttachment = (index: number) => {
        setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const checkVlinkStatus = async () => {
        try {
            const alive = await window.go.main.App.IsVlinkPortAlive();
            setVlinkStatus(alive ? 'ok' : 'error');
        } catch {
            setVlinkStatus('error');
        }
    };

    const startVlinkPolling = () => {
        if (vlinkTimerRef.current) return;
        vlinkTimerRef.current = window.setInterval(checkVlinkStatus, 2000);
        checkVlinkStatus();
    };

    const stopVlinkPolling = () => {
        if (vlinkTimerRef.current) {
            window.clearInterval(vlinkTimerRef.current);
            vlinkTimerRef.current = null;
        }
        setVlinkStatus('idle');
    };

    const requestInstallVlink = () =>
        new Promise<{ confirmed: boolean; password: string }>((resolve) => {
            setVlinkPassword('');
            setInstallModalOpen(true);
            setInstallResolve(() => resolve);
        });

    const loadVlinkConfig = async () => {
        const appApi = window.go?.main?.App;
        if (!appApi || typeof appApi.GetVlinkConfig !== 'function') {
            return;
        }
        try {
            const config = await appApi.GetVlinkConfig();
            setVlinkConfigError('');
            setVlinkConfigPath(config?.path ?? '');
            setVlinkConfigDraft(config?.content ?? '');
            setVlinkConfigOpen(true);
        } catch {
            setVlinkConfigError('配置加载失败，请稍后重试。');
            setVlinkConfigOpen(true);
        }
    };

    const handleVlinkConfigSave = async () => {
        const appApi = window.go?.main?.App;
        if (!appApi || typeof appApi.SaveVlinkConfig !== 'function') {
            setVlinkConfigError('后端接口未就绪，请重启应用后再试。');
            return;
        }
        setVlinkConfigSaving(true);
        setVlinkConfigError('');
        try {
            await appApi.SaveVlinkConfig(vlinkConfigDraft);
            setVlinkConfigOpen(false);
            if (pendingVlinkStart) {
                setPendingVlinkStart(false);
                try {
                    await appApi.StartVlink();
                    startVlinkPolling();
                    setIsProxyEnabled(true);
                } catch {
                    stopVlinkPolling();
                    setIsProxyEnabled(false);
                    setVlinkConfigError('vlink 启动失败，请检查配置后重试。');
                    setVlinkConfigOpen(true);
                }
            }
        } catch {
            setVlinkConfigError('配置保存失败，请检查内容后再试。');
        } finally {
            setVlinkConfigSaving(false);
        }
    };

    const handleVlinkConfigCancel = () => {
        setVlinkConfigOpen(false);
        setPendingVlinkStart(false);
        setIsProxyEnabled(false);
    };

    const handleVlinkToggle = async () => {
        const nextState = !isProxyEnabled;
        try {
            if (nextState) {
                const appApi = window.go?.main?.App;
                if (!appApi || typeof appApi.StartVlink !== 'function') {
                    setUpdateResult('后端接口未就绪，请重启应用后再试。');
                    return;
                }

                let installed = false;
                if (typeof appApi.IsVlinkInstalled === 'function') {
                    installed = await appApi.IsVlinkInstalled();
                }

                if (!installed && typeof appApi.InstallVlink === 'function') {
                    const result = await requestInstallVlink();
                    if (!result?.confirmed) {
                        stopVlinkPolling();
                        return;
                    }
                    setInstallViewActive(true);
                    setInstallMessage('准备安装 vlink…');
                    await appApi.InstallVlink('', result.password);
                }

                try {
                    await appApi.StartVlink();
                    startVlinkPolling();
                    setIsProxyEnabled(true);
                } catch (startError) {
                    const message = String(startError?.message || startError || '');
                    const needsConfig = message.includes('vlink config');
                    const shouldPromptInstall = message.includes('no such file') || message.includes('vlink');
                    if (needsConfig) {
                        setPendingVlinkStart(true);
                        await loadVlinkConfig();
                        return;
                    }
                    if (shouldPromptInstall && typeof appApi.InstallVlink === 'function') {
                        const result = await requestInstallVlink();
                        if (!result?.confirmed) {
                            stopVlinkPolling();
                            return;
                        }
                        setInstallViewActive(true);
                        setInstallMessage('准备安装 vlink…');
                        await appApi.InstallVlink('', result.password);
                        await appApi.StartVlink();
                        startVlinkPolling();
                        setIsProxyEnabled(true);
                    } else {
                        throw startError;
                    }
                }
            } else {
                await window.go.main.App.StopVlink();
                stopVlinkPolling();
                setIsProxyEnabled(false);
            }
        } catch {
            setIsProxyEnabled((prev) => !prev);
        }
    };

    const handleUpdateConfirm = async () => {
        setUpdateInProgress(true);
        setUpdateResult('正在检查和更新，请稍候...');
        try {
            const result = await window.go.main.App.SelfUpdate();
            setUpdateResult(result);
        } catch (e) {
            setUpdateResult(`更新失败: ${e}`);
        } finally {
            setUpdateInProgress(false);
        }
    };

    const handleSettingsSave = async () => {
        if (!settingsDraft) return;
        setSettingsError('');
        try {
            await window.go.main.App.SaveSettings(settingsDraft);
        } catch {
            setSettingsError('设置保存失败');
        }
    };

    const updateSettingsDraft = (updater: (prev: AppSettings) => AppSettings) => {
        setSettingsDraft((prev) => updater(prev ?? fallbackSettings));
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleToggleTodo = (id: string) => {
        setTodos((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, status: item.status === 'done' ? 'todo' : 'done' }
                    : item
            )
        );
    };


    const isSubpage = activeView !== 'home';
    const pageTitleMap: Record<typeof activeView, string> = {
        home: '首页',
        settings: '设置',
        board: '任务看板',
        editor: '文章编辑',
        pomodoro: '番茄计时器',
    };

    return (
        <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
            <div className="domour-shell" id="mainView">
                {!isSubpage && (
                    <header className="domour-header">
                        <div>
                            <div className="domour-title">Domour Copilot</div>
                            <div className="domour-subtitle">协同优先 · 自动化放权</div>
                        </div>
                        <div className="domour-status">
                            <Badge appearance="filled" color="brand">Cosmos-Star 在线</Badge>
                            <Badge appearance="outline">本地模式</Badge>
                            <ToggleButton
                                checked={isProxyEnabled}
                                onClick={handleVlinkToggle}
                                appearance="subtle"
                            >
                                网络加速
                                <span className={`status-dot ${vlinkStatus}`} title={vlinkStatus === 'ok' ? '正常' : vlinkStatus === 'error' ? '异常' : '未启动'} />
                            </ToggleButton>
                        </div>
                    </header>
                )}

                {isSubpage && (
                    <div className="subpage-home">
                        <Button
                            appearance="secondary"
                            icon={<Home24Regular />}
                            onClick={() => setActiveView('home')}
                            aria-label="返回首页"
                            title="返回首页"
                        />
                        <div className="subpage-title">{pageTitleMap[activeView]}</div>
                    </div>
                )}

                <main
                    className={`domour-main ${activeView === 'settings' ? 'settings-view' : ''} ${
                        activeView === 'board' ? 'board-view' : ''
                    } ${activeView === 'editor' ? 'editor-view' : ''}`}
                >
                    {activeView === 'settings' ? (
                        <Settings
                            settings={currentSettings}
                            error={settingsError}
                            onBack={() => setActiveView('home')}
                            onSave={handleSettingsSave}
                            onUpdate={updateSettingsDraft}
                        />
                    ) : activeView === 'board' ? (
                        <WorkBoard items={todos} onBack={() => setActiveView('home')} />
                    ) : activeView === 'editor' ? (
                        <ArticleEditor
                            content={articleDraft}
                            onChange={setArticleDraft}
                            onBack={() => setActiveView('home')}
                        />
                    ) : activeView === 'pomodoro' ? (
                        <Pomodoro
                            notifyDesktop={currentSettings.pomodoroNotifyDesktop}
                            notifySound={currentSettings.pomodoroNotifySound}
                        />
                    ) : (
                        <Dashboard
                            metrics={metrics}
                            quickActions={quickActions}
                            activityFeed={activityFeed}
                            messages={messages}
                            onNewSession={handleNewSession}
                            inputValue={inputValue}
                            onInputChange={setInputValue}
                            onInputKeyDown={handleInputKeyDown}
                            onSend={handleSend}
                            pendingAttachments={pendingAttachments}
                            onAttachFiles={handleAttachFiles}
                            onRemoveAttachment={removeAttachment}
                            fileInputRef={fileInputRef}
                            chatBodyRef={chatBodyRef}
                            todoItems={todos}
                            onToggleTodo={handleToggleTodo}
                            onOpenBoard={() => setActiveView('board')}
                            onOpenEditor={() => setActiveView('editor')}
                            onOpenPomodoro={() => setActiveView('pomodoro')}
                        />
                    )}
                </main>
            </div>

            {installViewActive && (
                <div className="install-shell" id="installView" aria-hidden="false">
                    <div className="install-card">
                        <div className="install-title">正在安装 vlink</div>
                        <div className="install-subtitle">请保持窗口开启，安装完成后会自动返回首页。</div>
                        <div className="install-progress" id="installProgress">{installMessage}</div>
                    </div>
                </div>
            )}

            <Dialog open={installModalOpen} onOpenChange={(_, data) => setInstallModalOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>安装 vlink</DialogTitle>
                        <DialogContent>
                            <Body1>未检测到 vlink，是否自动下载安装？</Body1>
                            {!isWindows ? (
                                <div className="modal-field">
                                    <Caption1>sudo 密码</Caption1>
                                    <Input
                                        type="password"
                                        value={vlinkPassword}
                                        onChange={(event) => setVlinkPassword(event.target.value)}
                                        placeholder="请输入 sudo 密码"
                                    />
                                    <Caption1>密码仅用于本次安装，不会保存。</Caption1>
                                </div>
                            ) : (
                                <div className="modal-field">
                                    <Caption1>Windows 无需 sudo 密码。</Caption1>
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setInstallModalOpen(false);
                                    if (installResolve) installResolve({ confirmed: false, password: '' });
                                }}
                            >
                                取消
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={() => {
                                    setInstallModalOpen(false);
                                    const trimmed = vlinkPassword.trim();
                                    if (installResolve) installResolve({ confirmed: isWindows || trimmed.length > 0, password: trimmed });
                                }}
                            >
                                开始安装
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <Dialog open={vlinkConfigOpen} onOpenChange={(_, data) => setVlinkConfigOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>配置 vlink</DialogTitle>
                        <DialogContent>
                            <Body1>未检测到 vlink 配置文件，请补充后再启动。</Body1>
                            <div className="modal-field">
                                <Caption1>配置路径</Caption1>
                                <Input value={vlinkConfigPath || '未知路径'} readOnly />
                            </div>
                            <div className="modal-field">
                                <Caption1>配置内容</Caption1>
                                <div className="vlink-config-editor">
                                    <MonacoEditor
                                        value={vlinkConfigDraft}
                                        onChange={(value) => setVlinkConfigDraft(value ?? '')}
                                        language="json"
                                        theme={isDarkMode ? 'vs-dark' : 'vs'}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 13,
                                            scrollBeyondLastLine: false,
                                            wordWrap: 'on',
                                            formatOnPaste: true,
                                            formatOnType: true,
                                            automaticLayout: true,
                                            fontFamily:
                                                "'Cascadia Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                                        }}
                                        height={260}
                                    />
                                </div>
                            </div>
                            {vlinkConfigError && <Caption1>{vlinkConfigError}</Caption1>}
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={handleVlinkConfigCancel}>
                                取消
                            </Button>
                            <Button appearance="primary" onClick={handleVlinkConfigSave} disabled={vlinkConfigSaving}>
                                保存并启动
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <Dialog open={aboutOpen} onOpenChange={(_, data) => setAboutOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>关于 Domour Copilot</DialogTitle>
                        <DialogContent>
                            <pre style={{ whiteSpace: 'pre-wrap' }}>{aboutText}</pre>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="primary" onClick={() => setAboutOpen(false)}>关闭</Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <Dialog open={updateOpen} onOpenChange={(_, data) => setUpdateOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>检查更新</DialogTitle>
                        <DialogContent>
                            {updateResult ? (
                                <Body1>{updateResult}</Body1>
                            ) : (
                                <Body1>是否立即检查并更新？</Body1>
                            )}
                            {updateInProgress && (
                                <div style={{ marginTop: 12 }}>
                                    <Spinner size="tiny" />
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions>
                            {!updateResult && !updateInProgress && (
                                <Button appearance="secondary" onClick={() => setUpdateOpen(false)}>取消</Button>
                            )}
                            {!updateResult && !updateInProgress && (
                                <Button appearance="primary" onClick={handleUpdateConfirm}>开始更新</Button>
                            )}
                            {(updateResult || updateInProgress) && (
                                <Button appearance="primary" onClick={() => setUpdateOpen(false)}>关闭</Button>
                            )}
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

        </FluentProvider>
    );
}
