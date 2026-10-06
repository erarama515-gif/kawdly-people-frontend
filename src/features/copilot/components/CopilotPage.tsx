import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { suggestedQueries, exampleResponse } from '../data';

// ─── Send Icon ────────────────────────────────────────────────────────────────

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 8L2 2l2.5 6L2 14l12-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Spark Icon ───────────────────────────────────────────────────────────────

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 2l1.8 5.4 5.4 1.8-5.4 1.8L10 16.6l-1.8-5.6L2.8 9.2l5.4-1.8L10 2z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

// ─── Hero Card (navy gradient) ────────────────────────────────────────────────

function HeroCard() {
  const { t } = useTranslation();
  return (
    <div
      className="relative overflow-hidden rounded-[3px] bg-navy p-6 text-on-navy"
      style={{
        backgroundImage:
          'radial-gradient(500px 280px at 100% 0%, rgba(31,123,184,.55), transparent 70%), radial-gradient(300px 200px at 0% 100%, rgba(232,87,70,.25), transparent 70%)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-white/10">
          <SparkIcon className="text-on-navy" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-on-navy">
            {t('copilot.heroTitle')}
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-on-navy/75">
            {t('copilot.heroDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Query Input ──────────────────────────────────────────────────────────────

interface QueryInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

function QueryInput({ value, onChange, onSubmit }: QueryInputProps) {
  const { t } = useTranslation();
  return (
    <div className="relative flex items-center">
      <input
        type="text"
        placeholder={t('copilot.inputPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        className={cn(
          'h-12 w-full rounded-full border border-hairline bg-surface pl-5 pr-14 text-[14px] text-ink placeholder:text-ink-faint',
          'shadow-sm focus:outline-none focus:ring-2 focus:ring-navy/30',
        )}
      />
      <button
        type="button"
        onClick={onSubmit}
        aria-label={t('copilot.submitQuery')}
        className={cn(
          'absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-navy text-on-navy',
          'transition-colors hover:bg-navy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40',
        )}
      >
        <SendIcon />
      </button>
    </div>
  );
}

// ─── Suggested Query Chips ────────────────────────────────────────────────────

interface SuggestedChipsProps {
  onSelect: (label: string) => void;
}

function SuggestedChips({ onSelect }: SuggestedChipsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">{t('copilot.suggestedQueries')}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestedQueries.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(q.label)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-[3px] border border-hairline bg-surface px-4 py-3 text-left',
              'transition-colors hover:border-navy/40 hover:bg-navy/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
            )}
          >
            <span className="text-[13px] font-semibold text-ink">{q.label}</span>
            <span className="text-[11px] text-ink-faint">{q.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Example Response Card ────────────────────────────────────────────────────

function ExampleResponseCard() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-0">
      <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-faint">{t('copilot.exampleResponse')}</p>
      <Card className="overflow-hidden">
        {/* Query echo */}
        <div className="border-b border-divider bg-surface px-5 py-3">
          <div className="flex items-center gap-2">
            <SparkIcon className="shrink-0 text-navy" />
            <span className="text-[13px] font-semibold text-navy">{exampleResponse.query}</span>
          </div>
        </div>

        {/* Response body */}
        <div
          className="border-l-[3px] border-navy px-5 py-4"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(10,32,63,0.03) 0%, transparent 60%)',
          }}
        >
          {/* Highlight numbers */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {exampleResponse.highlights.map((h) => (
              <div key={h.label} className="flex flex-col gap-0.5">
                <span className="nums font-mono text-[18px] font-bold tracking-[-0.04em] text-navy">{h.value}</span>
                <span className="text-[11px] text-ink-muted">{h.label}</span>
              </div>
            ))}
          </div>

          {/* Answer text */}
          <p className="text-[14px] leading-relaxed text-ink">{exampleResponse.answer}</p>
        </div>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CopilotPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    // Seam for real API call — swap with a mutation/fetch
    if (!query.trim()) return;
    setQuery('');
  };

  return (
    <div className="flex flex-col">
      <PageHeader title={t('copilot.title')} />

      <div className="flex flex-col gap-6">
        <HeroCard />

        <QueryInput value={query} onChange={setQuery} onSubmit={handleSubmit} />

        <SuggestedChips onSelect={(label) => setQuery(label)} />

        <ExampleResponseCard />
      </div>

      <div className="h-10" aria-hidden="true" />
    </div>
  );
}
