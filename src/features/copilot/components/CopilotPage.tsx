import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { askCopilot, type CopilotAnswer } from '../api/copilotClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

interface AssistantMessage {
  id: string;
  role: 'assistant';
  answer: CopilotAnswer;
}

interface ThinkingMessage {
  id: string;
  role: 'thinking';
}

type Message = UserMessage | AssistantMessage | ThinkingMessage;

// ─── Table Renderer ───────────────────────────────────────────────────────────

function DataTable({ raw }: { raw: CopilotAnswer['raw'] }) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;

  // String array: simple list
  if (typeof raw[0] === 'string') {
    const items = raw as string[];
    return (
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="text-[13px] text-ink">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  // Object array: table with column headers
  const rows = raw as Record<string, unknown>[];
  const cols = Object.keys(rows[0]);

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                className="border-b border-hairline px-3 py-1.5 text-left font-semibold capitalize text-ink-faint"
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-transparent' : 'bg-navy/[0.03]'}>
              {cols.map((col) => (
                <td key={col} className="px-3 py-1.5 text-ink">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[72%] rounded-[12px] rounded-tr-[3px] bg-navy px-4 py-2.5 text-[14px] leading-relaxed text-on-navy shadow-sm">
        {text}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface shadow-sm">
        <User className="h-4 w-4 text-ink-faint" />
      </div>
    </div>
  );
}

function AssistantBubble({ answer }: { answer: CopilotAnswer }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy shadow-sm">
        <Sparkles className="h-4 w-4 text-on-navy" />
      </div>
      <div className="max-w-[80%] rounded-[12px] rounded-tl-[3px] border border-hairline bg-surface px-4 py-2.5 shadow-sm">
        {answer.type === 'number' && answer.raw != null && (
          <div className="mb-1 font-mono text-[22px] font-bold tracking-[-0.04em] text-navy">
            {typeof answer.raw === 'number' ? answer.raw.toLocaleString() : String(answer.raw)}
          </div>
        )}
        <p className="text-[14px] leading-relaxed text-ink">{answer.answer}</p>
        {answer.type === 'table' && <DataTable raw={answer.raw} />}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy shadow-sm">
        <Sparkles className="h-4 w-4 text-on-navy" />
      </div>
      <div className="rounded-[12px] rounded-tl-[3px] border border-hairline bg-surface px-4 py-2.5 shadow-sm">
        <span className="flex items-center gap-2 text-[13px] text-ink-faint">
          <span
            className="inline-flex gap-[3px]"
            aria-label={t('copilot.thinking')}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-navy/50"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          {t('copilot.thinking')}
        </span>
      </div>
    </div>
  );
}

// ─── Welcome State ────────────────────────────────────────────────────────────

interface WelcomeProps {
  onSelect: (q: string) => void;
}

function WelcomeState({ onSelect }: WelcomeProps) {
  const { t } = useTranslation();
  const suggestions: Array<{ key: string; text: string }> = [
    { key: 'employeeCount', text: t('copilot.suggestion.employeeCount') },
    { key: 'newHires', text: t('copilot.suggestion.newHires') },
    { key: 'departments', text: t('copilot.suggestion.departments') },
    { key: 'avgSalary', text: t('copilot.suggestion.avgSalary') },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy shadow-lg">
        <MessageSquare className="h-7 w-7 text-on-navy" />
      </div>
      <p className="mb-6 max-w-[400px] text-[14px] leading-relaxed text-ink">
        {t('copilot.welcome')}
      </p>
      <div className="grid w-full max-w-[480px] grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map(({ key, text }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(text)}
            className={cn(
              'rounded-[8px] border border-hairline bg-surface px-4 py-2.5 text-left text-[13px] font-medium text-ink',
              'transition-colors hover:border-navy/40 hover:bg-navy/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CopilotPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMsgId = crypto.randomUUID();
    const thinkingId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: trimmed } satisfies UserMessage,
      { id: thinkingId, role: 'thinking' } satisfies ThinkingMessage,
    ]);
    setInput('');
    setLoading(true);

    try {
      const answer = await askCopilot(trimmed);
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== thinkingId)
          .concat({ id: crypto.randomUUID(), role: 'assistant', answer } satisfies AssistantMessage)
      );
    } catch {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== thinkingId)
          .concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            answer: {
              answer: 'Something went wrong. Please try again.',
              type: 'text',
              raw: null,
            },
          } satisfies AssistantMessage)
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = () => sendQuestion(input);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('copilot.title')} />

      {/* Chat area */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px] border border-hairline bg-canvas">
        <div
          className="flex flex-1 flex-col overflow-y-auto p-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          {messages.length === 0 ? (
            <WelcomeState onSelect={(q) => sendQuestion(q)} />
          ) : (
            <div className="flex flex-col gap-4 px-2 pb-2">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return <UserBubble key={msg.id} text={msg.text} />;
                }
                if (msg.role === 'thinking') {
                  return <ThinkingBubble key={msg.id} />;
                }
                return <AssistantBubble key={msg.id} answer={msg.answer} />;
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-hairline bg-surface px-4 py-3">
          <div className="relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={t('copilot.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
              className={cn(
                'h-11 flex-1 rounded-full border border-hairline bg-canvas ps-5 pe-4 text-[14px] text-ink placeholder:text-ink-faint',
                'shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              aria-label={t('copilot.send')}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-on-navy shadow-sm',
                'transition-colors hover:bg-navy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-8" aria-hidden="true" />
    </div>
  );
}
