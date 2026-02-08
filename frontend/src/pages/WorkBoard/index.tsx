import React, { useMemo, useState } from 'react';
import { Button } from '@fluentui/react-components';
import { TodoItem, TodoStatus } from '../../components/TodoList';

type WorkBoardProps = {
    items: TodoItem[];
    onBack: () => void;
};

type BoardMode = 'kanban' | 'gantt' | 'calendar';

const statusLabels: Record<TodoStatus, string> = {
    todo: '待开始',
    doing: '进行中',
    done: '已完成',
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatShortDate = (date: Date) => `${date.getMonth() + 1}.${date.getDate()}`;

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const getDayDiff = (start: Date, end: Date) => {
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
};

export default function WorkBoard({ items, onBack }: WorkBoardProps) {
    const [mode, setMode] = useState<BoardMode>('kanban');

    const ganttBaseDate = useMemo(() => {
        const dates = items.map((item) => new Date(item.start).getTime());
        const base = new Date(Math.min(...dates));
        base.setHours(0, 0, 0, 0);
        return base;
    }, [items]);

    const ganttDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, index) => addDays(ganttBaseDate, index));
    }, [ganttBaseDate]);

    const calendarDays = ganttDays;

    const itemsByStatus = (status: TodoStatus) => items.filter((item) => item.status === status);

    return (
        <section className="board-page">
            <div className="board-header">
                <div>
                    <div className="board-title">任务看板</div>
                    <div className="muted">统一视角查看优先级、进度与排期</div>
                </div>
                <div className="board-actions">
                    <div className="board-modes">
                        <Button
                            appearance={mode === 'kanban' ? 'primary' : 'secondary'}
                            size="small"
                            onClick={() => setMode('kanban')}
                        >
                            看板
                        </Button>
                        <Button
                            appearance={mode === 'gantt' ? 'primary' : 'secondary'}
                            size="small"
                            onClick={() => setMode('gantt')}
                        >
                            Gantt
                        </Button>
                        <Button
                            appearance={mode === 'calendar' ? 'primary' : 'secondary'}
                            size="small"
                            onClick={() => setMode('calendar')}
                        >
                            日历
                        </Button>
                    </div>
                    <Button appearance="secondary" onClick={onBack}>
                        返回首页
                    </Button>
                </div>
            </div>

            {mode === 'kanban' && (
                <div className="kanban-board">
                    {(['todo', 'doing', 'done'] as TodoStatus[]).map((status) => (
                        <div className="kanban-column" key={status}>
                            <div className={`kanban-title ${status}`}>
                                {statusLabels[status]}
                                <span className="kanban-count">{itemsByStatus(status).length}</span>
                            </div>
                            <div className="kanban-cards">
                                {itemsByStatus(status).map((item) => (
                                    <div className="kanban-card" key={item.id}>
                                        <div className="kanban-card-title">{item.title}</div>
                                        <div className="kanban-card-meta">
                                            <span>{item.owner}</span>
                                            <span>{item.due}</span>
                                        </div>
                                        <span className={`todo-tag ${item.status}`}>{item.tag}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {mode === 'gantt' && (
                <div className="gantt-board">
                    <div className="gantt-grid gantt-header">
                        <div className="gantt-cell gantt-label">任务</div>
                        {ganttDays.map((day, index) => (
                            <div className="gantt-cell gantt-day" key={`${day.toISOString()}-${index}`}>
                                <div className="gantt-day-name">{weekdayLabels[index % 7]}</div>
                                <div className="gantt-day-date">{formatShortDate(day)}</div>
                            </div>
                        ))}
                    </div>
                    <div className="gantt-rows">
                        {items.map((item) => {
                            const startDate = new Date(item.start);
                            const endDate = new Date(item.end);
                            const startOffset = Math.max(0, getDayDiff(ganttBaseDate, startDate));
                            const endOffset = Math.min(ganttDays.length - 1, getDayDiff(ganttBaseDate, endDate));
                            if (endOffset < 0 || startOffset > ganttDays.length - 1) {
                                return null;
                            }
                            const span = Math.max(1, endOffset - startOffset + 1);
                            return (
                                <div className="gantt-grid gantt-row" key={item.id}>
                                    <div className="gantt-cell gantt-label">
                                        <div className="gantt-item-title">{item.title}</div>
                                        <div className="gantt-item-meta">{item.owner}</div>
                                    </div>
                                    {ganttDays.map((_, index) => (
                                        <div className="gantt-cell" key={`${item.id}-${index}`} />
                                    ))}
                                    <div
                                        className={`gantt-bar ${item.status}`}
                                        style={{ gridColumn: `${startOffset + 2} / span ${span}` }}
                                    >
                                        {item.tag}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {mode === 'calendar' && (
                <div className="calendar-board">
                    {calendarDays.map((day, index) => {
                        const dayKey = day.toISOString().slice(0, 10);
                        const dayItems = items.filter((item) => item.due === dayKey);
                        return (
                            <div className="calendar-cell" key={dayKey}>
                                <div className="calendar-head">
                                    <span className="calendar-weekday">{weekdayLabels[index % 7]}</span>
                                    <span className="calendar-date">{formatShortDate(day)}</span>
                                </div>
                                <div className="calendar-items">
                                    {dayItems.map((item) => (
                                        <div className={`calendar-item ${item.status}`} key={item.id}>
                                            <span className="calendar-title">{item.title}</span>
                                            <span className="calendar-tag">{item.tag}</span>
                                        </div>
                                    ))}
                                    {dayItems.length === 0 && (
                                        <div className="calendar-empty">暂无任务</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
