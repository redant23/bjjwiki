'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Quote,
  Code,
  Minus,
} from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

// Selected text is wrapped with before/after; with no selection, placeholder is inserted and selected.
type InlineFormat = { type: 'inline'; before: string; after: string; placeholder: string };
// Prefix is toggled on every line touched by the selection.
type LineFormat = { type: 'line'; prefix: string };
// A standalone block inserted at the cursor, replacing the current selection.
type BlockFormat = { type: 'block'; insert: string };

type ToolbarAction = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  format: InlineFormat | LineFormat | BlockFormat;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { key: 'bold', label: '굵게', icon: Bold, format: { type: 'inline', before: '**', after: '**', placeholder: '굵은 텍스트' } },
  { key: 'italic', label: '기울임', icon: Italic, format: { type: 'inline', before: '*', after: '*', placeholder: '기울임 텍스트' } },
  { key: 'strikethrough', label: '취소선', icon: Strikethrough, format: { type: 'inline', before: '~~', after: '~~', placeholder: '취소선 텍스트' } },
  { key: 'h1', label: '제목 1', icon: Heading1, format: { type: 'line', prefix: '# ' } },
  { key: 'h2', label: '제목 2', icon: Heading2, format: { type: 'line', prefix: '## ' } },
  { key: 'h3', label: '제목 3', icon: Heading3, format: { type: 'line', prefix: '### ' } },
  { key: 'bullet-list', label: '글머리 목록', icon: List, format: { type: 'line', prefix: '- ' } },
  { key: 'ordered-list', label: '번호 목록', icon: ListOrdered, format: { type: 'line', prefix: '1. ' } },
  { key: 'link', label: '링크', icon: Link2, format: { type: 'inline', before: '[', after: '](url)', placeholder: '링크 텍스트' } },
  { key: 'quote', label: '인용', icon: Quote, format: { type: 'line', prefix: '> ' } },
  { key: 'code', label: '코드', icon: Code, format: { type: 'inline', before: '`', after: '`', placeholder: '코드' } },
  { key: 'hr', label: '구분선', icon: Minus, format: { type: 'block', insert: '\n\n---\n\n' } },
];

function applyInlineFormat(value: string, start: number, end: number, format: InlineFormat) {
  const selected = value.slice(start, end);
  const text = selected || format.placeholder;
  const newValue = value.slice(0, start) + format.before + text + format.after + value.slice(end);
  const selectionStart = start + format.before.length;
  const selectionEnd = selectionStart + text.length;
  return { newValue, selectionStart, selectionEnd };
}

function applyLineFormat(value: string, start: number, end: number, format: LineFormat) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allPrefixed = lines.every(line => line.startsWith(format.prefix));

  const newLines = lines.map(line =>
    allPrefixed ? line.slice(format.prefix.length) : format.prefix + line
  );
  const newBlock = newLines.join('\n');

  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  const delta = allPrefixed ? -format.prefix.length : format.prefix.length;
  return {
    newValue,
    selectionStart: Math.max(lineStart, start + delta),
    selectionEnd: Math.max(lineStart, end + delta * lines.length),
  };
}

function applyBlockFormat(value: string, start: number, end: number, format: BlockFormat) {
  const newValue = value.slice(0, start) + format.insert + value.slice(end);
  const cursor = start + format.insert.length;
  return { newValue, selectionStart: cursor, selectionEnd: cursor };
}

export function MarkdownEditor({ value, onChange, placeholder, label }: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToolbarClick = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart: start, selectionEnd: end } = textarea;
    let result: { newValue: string; selectionStart: number; selectionEnd: number };

    switch (action.format.type) {
      case 'inline':
        result = applyInlineFormat(value, start, end, action.format);
        break;
      case 'line':
        result = applyLineFormat(value, start, end, action.format);
        break;
      case 'block':
        result = applyBlockFormat(value, start, end, action.format);
        break;
    }

    onChange(result.newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

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
          <>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 p-1">
              {TOOLBAR_ACTIONS.map(action => (
                <button
                  key={action.key}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  onClick={() => handleToolbarClick(action)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <action.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-4 min-h-[300px] bg-transparent outline-none resize-y font-mono text-sm"
              placeholder={placeholder}
            />
          </>
        ) : (
          <div className="w-full p-4 min-h-[300px] prose prose-zinc dark:prose-invert max-w-none overflow-y-auto">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">미리보기 내용이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
