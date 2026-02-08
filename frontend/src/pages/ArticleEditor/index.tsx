import React from 'react';
import { Button, Subtitle1, Textarea } from '@fluentui/react-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ArticleEditorProps = {
    content: string;
    onChange: (next: string) => void;
    onBack: () => void;
};

export default function ArticleEditor({ content, onChange, onBack }: ArticleEditorProps) {
    return (
        <section className="editor-page">
            <div className="editor-header">
                <div>
                    <Subtitle1>文章编辑</Subtitle1>
                    <div className="muted">Markdown 编辑与预览</div>
                </div>
                <div className="editor-actions">
                    <Button appearance="secondary" onClick={onBack}>返回</Button>
                    <Button appearance="primary">保存草稿</Button>
                </div>
            </div>

            <div className="editor-grid">
                <div className="editor-panel">
                    <div className="panel-title">Markdown</div>
                    <Textarea
                        value={content}
                        onChange={(event) => onChange(event.target.value)}
                        resize="vertical"
                        className="editor-input"
                        placeholder="在此输入 Markdown 内容..."
                    />
                </div>
                <div className="editor-panel">
                    <div className="panel-title">预览</div>
                    <div className="editor-preview markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </div>
                </div>
            </div>
        </section>
    );
}
