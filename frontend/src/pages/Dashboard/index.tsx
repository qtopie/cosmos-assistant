import React from 'react';
import {
  Button,
  Card,
  Text,
  Subtitle1,
  Caption1,
  Body1,
} from '@fluentui/react-components';
import ChatPanel, { ChatMessage } from '../../components/ChatPanel';
import TodoList, { TodoItem } from '../../components/TodoList';

type MetricItem = {
  label: string;
  value: string;
  trend: string;
};

type ActivityItem = {
  time: string;
  text: string;
};

type DashboardProps = {
  metrics: MetricItem[];
  quickActions: string[];
  activityFeed: ActivityItem[];
  messages: ChatMessage[];
  onNewSession: () => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  pendingAttachments: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  chatBodyRef: React.RefObject<HTMLDivElement>;
  todoItems: TodoItem[];
  onToggleTodo: (id: string) => void;
  onOpenBoard: () => void;
  onOpenEditor: () => void;
  onOpenPomodoro: () => void;
};

export default function Dashboard({
  metrics,
  quickActions,
  activityFeed,
  messages,
  onNewSession,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onSend,
  pendingAttachments,
  onAttachFiles,
  onRemoveAttachment,
  fileInputRef,
  chatBodyRef,
  todoItems,
  onToggleTodo,
  onOpenBoard,
  onOpenEditor,
  onOpenPomodoro,
}: DashboardProps) {
  return (
    <>
      <section className="dashboard">
        <div className="section-header">
          <Subtitle1>Dashboard</Subtitle1>
          <div className="header-actions">
            <Button appearance="secondary" onClick={onOpenEditor}>写文章</Button>
            <Button appearance="secondary" onClick={onOpenPomodoro}>番茄计时</Button>
            <Button appearance="secondary" onClick={onOpenBoard}>查看看板</Button>
          </div>
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

        <TodoList items={todoItems} onToggleItem={onToggleTodo} onOpenBoard={onOpenBoard} />
      </section>
      <ChatPanel
        messages={messages}
        onNewSession={onNewSession}
        inputValue={inputValue}
        onInputChange={onInputChange}
        onInputKeyDown={onInputKeyDown}
        onSend={onSend}
        pendingAttachments={pendingAttachments}
        onAttachFiles={onAttachFiles}
        onRemoveAttachment={onRemoveAttachment}
        fileInputRef={fileInputRef}
        chatBodyRef={chatBodyRef}
      />
    </>
  );
}
