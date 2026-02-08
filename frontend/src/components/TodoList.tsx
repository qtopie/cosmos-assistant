import React from 'react';
import { Button, Checkbox } from '@fluentui/react-components';

export type TodoStatus = 'todo' | 'doing' | 'done';

export type TodoItem = {
    id: string;
    title: string;
    owner: string;
    due: string;
    tag: string;
    status: TodoStatus;
    start: string;
    end: string;
};

type TodoListProps = {
    items: TodoItem[];
    onToggleItem: (id: string) => void;
    onOpenBoard: () => void;
};

export default function TodoList({ items, onToggleItem, onOpenBoard }: TodoListProps) {
    return (
        <div className="panel todo-panel">
            <div className="panel-title-row">
                <div>
                    <div className="panel-title">今日待办</div>
                    <div className="muted">聚焦关键节点与可执行任务</div>
                </div>
                <Button appearance="secondary" size="small" onClick={onOpenBoard}>
                    打开看板
                </Button>
            </div>
            <div className="todo-list">
                {items.map((item) => (
                    <div className={`todo-item ${item.status}`} key={item.id}>
                        <label className="todo-main">
                            <Checkbox
                                checked={item.status === 'done'}
                                onChange={() => onToggleItem(item.id)}
                            />
                            <div>
                                <div className="todo-title">{item.title}</div>
                                <div className="todo-meta">{item.owner} · {item.due}</div>
                            </div>
                        </label>
                        <span className={`todo-tag ${item.status}`}>{item.tag}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
