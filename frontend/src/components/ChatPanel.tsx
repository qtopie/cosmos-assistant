import React from 'react';
import { Button, Textarea } from '@fluentui/react-components';

export type ChatMessage = {
    role: 'assistant' | 'user';
    content: string;
    id?: string;
};

type ChatPanelProps = {
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
};

export default function ChatPanel({
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
}: ChatPanelProps) {
    return (
        <aside className="chat">
            <div className="chat-header">
                <div>
                    <div className="panel-title">Copilot 对话</div>
                    <div className="muted">人机协同 · 可控执行</div>
                </div>
                <Button appearance="secondary" size="small" onClick={onNewSession}>
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
                            onChange={(event) => onInputChange(event.target.value)}
                            onKeyDown={onInputKeyDown}
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
                                        onClick={() => onRemoveAttachment(index)}
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
                                onAttachFiles(files);
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
                        <Button appearance="primary" onClick={onSend}>
                            发送
                        </Button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
