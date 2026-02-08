import React from 'react';
import { Button, Card, Subtitle1, Caption1, Input, Textarea, Switch } from '@fluentui/react-components';

export type AppSettings = {
    displayName: string;
    autoUpdate: boolean;
    vlinkAutoStart: boolean;
    notes: string;
    pomodoroNotifyDesktop: boolean;
    pomodoroNotifySound: boolean;
};

type SettingsProps = {
    settings: AppSettings;
    error: string;
    onBack: () => void;
    onSave: () => void;
    onUpdate: (updater: (prev: AppSettings) => AppSettings) => void;
};

export default function Settings({ settings, error, onBack, onSave, onUpdate }: SettingsProps) {
    return (
        <section className="settings-page">
            <div className="settings-header">
                <div>
                    <Subtitle1>设置</Subtitle1>
                    <div className="muted">管理应用配置与偏好</div>
                </div>
                <div className="settings-actions">
                    <Button appearance="secondary" onClick={onBack}>
                        返回
                    </Button>
                    <Button appearance="primary" onClick={onSave}>
                        保存
                    </Button>
                </div>
            </div>

            <div className="settings-grid">
                <Card className="panel">
                    <div className="panel-title">基础信息</div>
                    <div className="settings-form">
                        <div className="modal-field">
                            <Caption1>显示名称</Caption1>
                            <Input
                                value={settings.displayName}
                                onChange={(event) =>
                                    onUpdate((prev) => ({ ...prev, displayName: event.target.value }))
                                }
                                placeholder="Domour Copilot"
                            />
                        </div>
                        <div className="modal-field">
                            <Caption1>备注</Caption1>
                            <Textarea
                                value={settings.notes}
                                onChange={(event) => onUpdate((prev) => ({ ...prev, notes: event.target.value }))}
                                placeholder="可选备注"
                                resize="vertical"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="panel">
                    <div className="panel-title">自动化</div>
                    <div className="settings-form">
                        <Switch
                            checked={settings.autoUpdate}
                            onChange={(_, data) => onUpdate((prev) => ({ ...prev, autoUpdate: data.checked }))}
                            label="启动时检查更新"
                        />
                        <Switch
                            checked={settings.vlinkAutoStart}
                            onChange={(_, data) => onUpdate((prev) => ({ ...prev, vlinkAutoStart: data.checked }))}
                            label="启动时自动开启网络加速"
                        />
                    </div>
                </Card>

                <Card className="panel">
                    <div className="panel-title">通知</div>
                    <div className="settings-form">
                        <Switch
                            checked={settings.pomodoroNotifyDesktop}
                            onChange={(_, data) =>
                                onUpdate((prev) => ({ ...prev, pomodoroNotifyDesktop: data.checked }))
                            }
                            label="番茄计时桌面通知"
                        />
                        <Switch
                            checked={settings.pomodoroNotifySound}
                            onChange={(_, data) =>
                                onUpdate((prev) => ({ ...prev, pomodoroNotifySound: data.checked }))
                            }
                            label="番茄计时提示音"
                        />
                    </div>
                </Card>
            </div>

            {error && <Caption1>{error}</Caption1>}
        </section>
    );
}