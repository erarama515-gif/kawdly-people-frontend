/**
 * ExportButton
 *
 * A secondary dropdown button that offers "Export to Excel" and "Export to PDF"
 * options.  Pass the current visible `data`, a `columns` descriptor (with
 * already-translated labels), and a base `filename` string.
 *
 * The dropdown closes when the user clicks outside (via a window listener)
 * or when an export action starts.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { exportToExcel, exportToPdf } from '@/lib/export';
import type { ExportColumn } from '@/lib/export';

export type { ExportColumn };

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  className?: string;
}

export function ExportButton({ data, columns, filename, className }: ExportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  async function handleExport(format: 'excel' | 'pdf') {
    setOpen(false);
    setExporting(true);
    try {
      // Yield to the browser so the loading state can paint before the
      // (synchronous) export computation blocks the main thread.
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      if (format === 'excel') {
        exportToExcel(data, columns, filename);
      } else {
        exportToPdf(data, columns, filename);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={exporting || data.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[3px] border border-hairline',
          'bg-surface px-3 text-[13px] font-semibold text-ink transition-colors',
          'hover:border-navy/40 hover:text-navy',
          'disabled:cursor-not-allowed disabled:text-ink-faint',
          open && 'border-navy/40 text-navy',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        {exporting ? t('common.exporting') : t('common.export')}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-50 mt-1 min-w-[172px] rounded-[4px] border border-hairline bg-surface shadow-md',
            'flex flex-col py-1',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleExport('excel')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink',
              'hover:bg-surface-hover hover:text-navy transition-colors',
            )}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.5} aria-hidden="true" />
            {t('common.exportExcel')}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void handleExport('pdf')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink',
              'hover:bg-surface-hover hover:text-navy transition-colors',
            )}
          >
            <FileText className="h-4 w-4 shrink-0 text-coral" strokeWidth={1.5} aria-hidden="true" />
            {t('common.exportPdf')}
          </button>
        </div>
      )}
    </div>
  );
}
