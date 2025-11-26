'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function MarkdownEditor({ value, onChange, placeholder, label }: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="border border-input rounded-md bg-background overflow-hidden">
        <div className="flex border-b border-input bg-muted/50">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'write'
                ? 'bg-background text-foreground border-r border-input'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            작성 (Write)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'preview'
                ? 'bg-background text-foreground border-l border-r border-input'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            미리보기 (Preview)
          </button>
        </div>

        {activeTab === 'write' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-4 min-h-[300px] bg-transparent outline-none resize-y font-mono text-sm"
            placeholder={placeholder}
          />
        ) : (
          <div className="w-full p-4 min-h-[300px] prose prose-zinc dark:prose-invert max-w-none overflow-y-auto">
            {value ? (
              <ReactMarkdown>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">미리보기 내용이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
