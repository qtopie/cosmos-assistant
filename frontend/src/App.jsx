import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    FluentProvider,
    webDarkTheme,
    Button,
    Card,
    Text,
    Subtitle1,
    Caption1,
    Body1,
    Textarea,
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
import { EventsOn } from '../wailsjs/runtime/runtime';

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

const starterMessages = [
    { role: 'assistant', content: '早上好！我可以帮你准备今日计划。' },
    { role: 'assistant', content: '是否要打开“专注办公”场景并同步设备状态？' },
];

const isLikelyTextFile = (file) => {
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

const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsText(file);
    });

const readFileAsBase64 = (file) =>
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

const prepareAttachments = async (files) => {
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
    const [messages, setMessages] = useState(starterMessages);
    const [inputValue, setInputValue] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const [isProxyEnabled, setIsProxyEnabled] = useState(false);
    const [vlinkStatus, setVlinkStatus] = useState('idle');
    const [installViewActive, setInstallViewActive] = useState(false);
    const [installMessage, setInstallMessage] = useState('准备开始…');

    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutText, setAboutText] = useState('');

    const [updateOpen, setUpdateOpen] = useState(false);
    const [updateInProgress, setUpdateInProgress] = useState(false);
    const [updateResult, setUpdateResult] = useState('');

    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [vlinkPassword, setVlinkPassword] = useState('');
    const [installResolve, setInstallResolve] = useState(null);

    const chatBodyRef = useRef(null);
    const fileInputRef = useRef(null);
    const vlinkTimerRef = useRef(null);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        EventsOn('vlink:install', (message) => {
            setInstallMessage(message || '-');
            if (message && message.includes('安装完成')) {
                window.setTimeout(() => {
                    setInstallViewActive(false);
                }, 800);
            }
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

    const handleAttachFiles = (files) => {
        if (!files || files.length === 0) return;
        setPendingAttachments((prev) => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
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
        new Promise((resolve) => {
            setVlinkPassword('');
            setInstallModalOpen(true);
            setInstallResolve(() => resolve);
        });

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
                    const shouldPromptInstall = message.includes('no such file') || message.includes('vlink');
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

    const handleInputKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };


    return (
        <FluentProvider theme={webDarkTheme}>
            <div className="domour-shell" id="mainView">
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

                <main className="domour-main">
                    <section className="dashboard">
                        <div className="section-header">
                            <Subtitle1>Dashboard</Subtitle1>
                            <Button appearance="secondary">查看全局</Button>
                        </div>
                        <div className="metric-grid" id="metricGrid">
                            {metrics.map((item) => (
                                <Card className="metric-card" key={item.label}>
                                    <Text weight="semibold">{item.label}</Text>
                                    <Text size={600}>{item.value}</Text>
                                    <Caption1>{item.trend}</Caption1>
                                </Card>
                            ))}
                        </div>

                        <div className="dashboard-row">
                            <Card className="panel">
                                <div className="panel-title">快捷操作</div>
                                <div className="chip-grid" id="quickActions">
                                    {quickActions.map((action) => (
                                        <Button key={action} appearance="outline" size="small">
                                            {action}
                                        </Button>
                                    ))}
                                </div>
                            </Card>
                            <Card className="panel">
                                <div className="panel-title">实时动态</div>
                                <ul className="activity" id="activityFeed">
                                    {activityFeed.map((item) => (
                                        <li key={`${item.time}-${item.text}`}>
                                            <span className="time">{item.time}</span>
                                            <span className="text">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </div>

                        <Card className="panel insight">
                            <div className="panel-title">协同建议</div>
                            <Body1>今日存在 3 个高风险步骤待确认。建议优先审阅“商业报表”生成链路。</Body1>
                            <div className="insight-actions">
                                <Button appearance="primary">进入审阅</Button>
                                <Button appearance="secondary">稍后提醒</Button>
                            </div>
                        </Card>
                    </section>

                    <aside className="chat">
                        <div className="chat-header">
                            <div>
                                <div className="panel-title">Copilot 对话</div>
                                <div className="muted">人机协同 · 可控执行</div>
                            </div>
                            <Button appearance="secondary" size="small" onClick={handleNewSession}>
                                新建会话
                            </Button>
                        </div>
                        <div className="chat-body" id="chatBody" ref={chatBodyRef}>
                            {messages.map((msg, index) => (
                                <div className={`chat-message ${msg.role}`} key={`${msg.role}-${index}`}>
                                    <div className="bubble">{msg.content}</div>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input">
                            <div className="chat-compose">
                                <div className="chat-compose-field">
                                    <Textarea
                                        value={inputValue}
                                        onChange={(event) => setInputValue(event.target.value)}
                                        onKeyDown={handleInputKeyDown}
                                        placeholder="输入任务或问题…"
                                        resize="vertical"
                                    />
                                    {pendingAttachments.length > 0 && (
                                        <div id="attachmentList" className="chat-attachments">
                                            {pendingAttachments.map((file, index) => (
                                                <button
                                                    key={`${file.name}-${index}`}
                                                    type="button"
                                                    className="chat-attachment"
                                                    onClick={() => removeAttachment(index)}
                                                >
                                                    {file.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="chat-actions">
                                    <input
                                        ref={fileInputRef}
                                        id="fileInput"
                                        type="file"
                                        multiple
                                        hidden
                                        onChange={(event) => {
                                            const files = Array.from(event.target.files || []);
                                            handleAttachFiles(files);
                                            event.target.value = '';
                                        }}
                                    />
                                    <Button
                                        appearance="secondary"
                                        size="small"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        + 附件
                                    </Button>
                                    <Button appearance="primary" onClick={handleSend}>
                                        发送
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </aside>
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
                                    if (installResolve) installResolve({ confirmed: vlinkPassword.trim().length > 0, password: vlinkPassword.trim() });
                                }}
                            >
                                开始安装
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
