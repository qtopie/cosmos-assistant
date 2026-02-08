import React, { useEffect, useMemo, useState } from 'react';
import { Button, Subtitle1 } from '@fluentui/react-components';

type PomodoroMode = 'focus' | 'short' | 'long';

type ModeConfig = {
    label: string;
    minutes: number;
};

const modeConfig: Record<PomodoroMode, ModeConfig> = {
    focus: { label: '专注', minutes: 25 },
    short: { label: '短休息', minutes: 5 },
    long: { label: '长休息', minutes: 15 },
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

type PomodoroProps = {
    notifyDesktop: boolean;
    notifySound: boolean;
};

export default function Pomodoro({ notifyDesktop, notifySound }: PomodoroProps) {
    const [mode, setMode] = useState<PomodoroMode>('focus');
    const [secondsLeft, setSecondsLeft] = useState(modeConfig.focus.minutes * 60);
    const [running, setRunning] = useState(false);

    const totalSeconds = modeConfig[mode].minutes * 60;

    useEffect(() => {
        setSecondsLeft(totalSeconds);
        setRunning(false);
    }, [mode, totalSeconds]);

    useEffect(() => {
        if (!running) return undefined;
        const timer = window.setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    window.clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [running]);

    useEffect(() => {
        if (secondsLeft === 0) {
            setRunning(false);
            if (notifyDesktop && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification('番茄计时完成', {
                        body: `${modeConfig[mode].label} 已结束。`,
                    });
                }
            }
            if (notifySound) {
                const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    const ctx = new AudioContextClass();
                    const oscillator = ctx.createOscillator();
                    const gain = ctx.createGain();
                    oscillator.type = 'sine';
                    oscillator.frequency.value = 880;
                    gain.gain.value = 0.08;
                    oscillator.connect(gain);
                    gain.connect(ctx.destination);
                    oscillator.start();
                    window.setTimeout(() => {
                        oscillator.stop();
                        ctx.close();
                    }, 420);
                }
            }
        }
    }, [secondsLeft, notifyDesktop, notifySound, mode]);

    const requestDesktopPermission = async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    const handleStartToggle = async () => {
        if (!running && notifyDesktop) {
            await requestDesktopPermission();
        }
        setRunning((prev) => !prev);
    };

    const progress = useMemo(() => {
        if (totalSeconds === 0) return 0;
        return Math.max(0, Math.min(1, secondsLeft / totalSeconds));
    }, [secondsLeft, totalSeconds]);

    return (
        <section className="pomodoro-page">
            <div className="pomodoro-header">
                <div>
                    <Subtitle1>番茄计时器</Subtitle1>
                    <div className="muted">保持节奏，专注执行</div>
                </div>
                <div className="pomodoro-actions">
                    <Button appearance="secondary" onClick={() => setSecondsLeft(totalSeconds)}>
                        重置
                    </Button>
                    <Button appearance="primary" onClick={handleStartToggle}>
                        {running ? '暂停' : '开始'}
                    </Button>
                </div>
            </div>

            <div className="pomodoro-card">
                <div className="pomodoro-modes">
                    {(['focus', 'short', 'long'] as PomodoroMode[]).map((item) => (
                        <Button
                            key={item}
                            size="small"
                            appearance={mode === item ? 'primary' : 'secondary'}
                            onClick={() => setMode(item)}
                        >
                            {modeConfig[item].label}
                        </Button>
                    ))}
                </div>

                <div className="pomodoro-timer">
                    <div className="pomodoro-ring" style={{ ['--progress' as string]: progress }}>
                        <div className="pomodoro-time">{formatTime(secondsLeft)}</div>
                        <div className="pomodoro-sub">{modeConfig[mode].label}</div>
                    </div>
                </div>

                <div className="pomodoro-footer">
                    <div className="pomodoro-stat">
                        <div className="stat-value">{modeConfig[mode].minutes} 分钟</div>
                        <div className="stat-label">当前时长</div>
                    </div>
                    <div className="pomodoro-stat">
                        <div className="stat-value">{formatTime(secondsLeft)}</div>
                        <div className="stat-label">剩余时间</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
