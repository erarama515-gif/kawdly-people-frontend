import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { DecisionQueueRow, QueueId } from '../model';

interface DecisionsSentenceProps {
  rows: DecisionQueueRow[];
  counts: Record<QueueId, number>;
  /** Rows whose count just hit 0 — chip plays its exit transition before unmounting. */
  removing: ReadonlySet<QueueId>;
}

const CHIP_EXIT = 'px-0 border-transparent opacity-0';

/**
 * The dashboard's core sentence on navy: "— items awaiting your decision today",
 * built from real queue state (counts + chips), never hardcoded. The total
 * reads as coral-on-white data inside a white pill; each chip carries its mono
 * count first, then the label (so it reads "17 Leave requests" in LTR).
 */
export function DecisionsSentence({ rows, counts, removing }: DecisionsSentenceProps) {
  const { t } = useTranslation();
  const chips = rows.filter((row) => (counts[row.id] ?? 0) > 0 || removing.has(row.id));
  const total = rows.reduce((sum, row) => sum + (counts[row.id] ?? 0), 0);

  if (total === 0) {
    return (
      <p role="status" className="animate-content-in text-[clamp(13px,2.2vw,18px)] text-on-navy-muted-85">
        <span className="font-medium text-on-navy">{t('dashboard.decisions.allClear')}</span>
      </p>
    );
  }

  return (
    <div
      role="status"
      className="animate-content-in flex flex-wrap items-center gap-x-3 gap-y-2 text-[clamp(13px,2.2vw,18px)] leading-snug text-on-navy"
    >
      <bdi className="nums rounded-full bg-surface px-[18px] py-[3px] text-[clamp(24px,6vw,30px)] font-bold leading-none tracking-[-0.05em] text-coral">
        {total}
      </bdi>

      {chips.map((row, index) => (
        <span
          key={row.id}
          className={cn(
            'inline-flex items-baseline overflow-hidden whitespace-nowrap rounded-full border border-[#9AA7B3] px-[14px] py-[4px] transition-[max-width,opacity,padding] duration-200 ease-out',
            removing.has(row.id) && CHIP_EXIT,
          )}
          style={{
            maxWidth: removing.has(row.id) ? 0 : 220,
            marginInlineEnd: index === chips.length - 1 ? 0 : undefined,
          }}
        >
          <b className="nums text-[clamp(13px,2vw,15px)] font-bold tracking-[-0.04em] text-on-navy">
            {counts[row.id] ?? 0}
          </b>
          <span className="ms-1.5">{t(`dashboard.decisions.chip.${row.id}`)}</span>
        </span>
      ))}

      <span className="text-on-navy-muted-85">{t('dashboard.decisions.suffix')}</span>
    </div>
  );
}