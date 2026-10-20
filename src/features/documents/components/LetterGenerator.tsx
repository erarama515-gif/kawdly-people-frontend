import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
// Arabic PDF notes:
// html2canvas is NOT currently a dependency. To add full Arabic PDF support,
// run: npm install html2canvas
// Then replace buildPdf() with the html2canvas path (see commented block below).
// Alternatively, embed the Amiri font via jsPDF.addFileToVFS + addFont with a
// base64-encoded .ttf blob — see https://artskydj.github.io/jsPDF/docs/jsPDF.html
import jsPDF from 'jspdf';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useEmployeeList } from '@/features/employees/api/queries';
import type { EmployeeWire } from '@/features/employees/api/schema';
import { useSettingList } from '@/features/settings/api/queries';
import {
  employmentCertificate,
  salaryCertificate,
  experienceLetter,
} from './letterTemplates';
import type { LetterContent } from './letterTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateKey = 'employmentCert' | 'salaryCert' | 'experienceLetter';

// ─── Company info ─────────────────────────────────────────────────────────────

interface CompanyInfo {
  /** Letterhead text. Falls back to a department label, never to a company. */
  name: string;
  /**
   * The `general.companyName` setting exactly as stored, empty string if unset.
   *
   * Kept separate from `name` because the two have different right answers when
   * the setting is missing: a letterhead reading "HR Department" is fine, but
   * a body sentence reading "employed with HR Department" is not. The letter
   * templates apply their own fallback to this value.
   */
  rawName: string;
  email: string;
}

/** Pull company name from the settings API; fall back gracefully. */
function useCompanyInfo(): CompanyInfo {
  const { state } = useSettingList({ companyId: 1, perPage: 100 });
  const settings = state.data?.data ?? [];

  const companyName = settings.find(
    (s) => s.group === 'general' && s.key === 'companyName',
  )?.value ?? '';

  const hrEmail = settings.find(
    (s) => s.group === 'general' && s.key === 'hrEmail',
  )?.value ?? '';

  return {
    name:    companyName || 'HR Department',
    rawName: companyName,
    email:   hrEmail || '',
  };
}

// ─── PDF generation ───────────────────────────────────────────────────────────

const PAGE_MARGIN = 20; // mm
const LINE_HEIGHT = 7;  // mm per text line

function buildPdf(
  _employee: EmployeeWire,
  content: LetterContent,
  company: CompanyInfo,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = pageWidth - PAGE_MARGIN * 2;

  let y = PAGE_MARGIN;

  // ── Company header ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(7, 45, 74); // --color-navy
  doc.text(company.name, PAGE_MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500 ≈ ink-muted
  doc.text('Human Resources Department', PAGE_MARGIN, y);
  y += 5;
  if (company.email) {
    doc.text(company.email, PAGE_MARGIN, y);
    y += 2;
  }

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200 ≈ hairline
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN, y + 2, pageWidth - PAGE_MARGIN, y + 2);
  y += 8;

  // ── Letter title ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(7, 45, 74);
  doc.text(content.title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ── Body ────────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // --color-ink

  const bodyLines = content.body.split('\n');
  for (const line of bodyLines) {
    if (line === '') {
      y += LINE_HEIGHT * 0.6;
      continue;
    }
    // Wrap long lines to fit within text width
    const wrapped = doc.splitTextToSize(line, textWidth) as string[];
    for (const wl of wrapped) {
      if (y > doc.internal.pageSize.getHeight() - PAGE_MARGIN - 20) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      doc.text(wl, PAGE_MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  y += 6;

  // ── Closing / signature block ───────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);

  const closingLines = content.closing.split('\n');
  for (const line of closingLines) {
    doc.text(line, PAGE_MARGIN, y);
    y += LINE_HEIGHT * 0.85;
  }

  y += 12;

  // Signature line
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 60, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Authorised Signature', PAGE_MARGIN, y);
  y += 5;
  doc.setTextColor(100, 116, 139);
  doc.text(`HR Department — ${company.name}`, PAGE_MARGIN, y);

  return doc;
}

// ─── Preview renderer ─────────────────────────────────────────────────────────

interface LetterPreviewProps {
  employee: EmployeeWire;
  content: LetterContent;
  company: CompanyInfo;
  previewRef?: React.RefObject<HTMLDivElement>;
}

function LetterPreview({ content, company, previewRef }: LetterPreviewProps) {
  return (
    <div
      ref={previewRef}
      className="rounded-[3px] border border-hairline bg-white p-6 font-mono text-[11px] leading-relaxed text-ink shadow-sm"
    >
      {/* Header */}
      <div className="mb-4 border-b border-hairline pb-3">
        <p className="text-[14px] font-bold text-navy">{company.name}</p>
        <p className="text-ink-muted">Human Resources Department</p>
        {company.email ? <p className="text-ink-muted">{company.email}</p> : null}
      </div>

      {/* Title */}
      <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-wide text-navy">
        {content.title}
      </p>

      {/* Body */}
      <pre className="whitespace-pre-wrap font-mono text-[11px] text-ink">{content.body}</pre>

      {/* Closing */}
      <div className="mt-4 border-t border-hairline pt-3">
        <pre className="whitespace-pre-wrap font-mono text-[10px] italic text-ink-muted">{content.closing}</pre>
        <div className="mt-6">
          <div className="mb-1 w-36 border-b border-ink-muted" />
          <p className="text-[10px] text-ink">Authorised Signature</p>
          <p className="text-[10px] text-ink-muted">HR Department — {company.name}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface LetterGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LetterGenerator({ open, onOpenChange }: LetterGeneratorProps) {
  const { t } = useTranslation();

  const [templateKey, setTemplateKey] = useState<TemplateKey>('employmentCert');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');

  // Fetch all employees for the dropdown (perPage:200 to cover most tenants)
  const { state: empState } = useEmployeeList({ perPage: 200 });
  const employees: EmployeeWire[] = empState.data?.data ?? [];

  // Fetch dynamic company info from the settings API
  const company = useCompanyInfo();

  // Ref for the preview div (reserved for future html2canvas path)
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  // company.name also feeds the letter BODY, not just the letterhead drawn by
  // buildPdf — see the FALLBACK_EMPLOYER note in letterTemplates.ts. Keep it in
  // the dependency list: the settings query resolves after first paint, so a
  // memo that ignored it would cache a letter built from the fallback name.
  const letterContent: LetterContent | null = useMemo(() => {
    if (!selectedEmployee) return null;
    if (templateKey === 'employmentCert') return employmentCertificate(selectedEmployee, company.rawName);
    if (templateKey === 'salaryCert') return salaryCertificate(selectedEmployee, company.rawName);
    return experienceLetter(selectedEmployee, company.rawName);
  }, [templateKey, selectedEmployee, company.rawName]);

  function handleDownload() {
    if (!selectedEmployee || !letterContent) return;
    const doc = buildPdf(selectedEmployee, letterContent, company);
    const safeName = `${selectedEmployee.first_name}_${selectedEmployee.last_name}`
      .toLowerCase()
      .replace(/\s+/g, '_');
    doc.save(`${templateKey}_${safeName}.pdf`);
  }

  const TEMPLATE_OPTIONS: Array<{ key: TemplateKey; label: string }> = [
    { key: 'employmentCert',   label: t('documents.letterGenerator.employmentCert') },
    { key: 'salaryCert',       label: t('documents.letterGenerator.salaryCert') },
    { key: 'experienceLetter', label: t('documents.letterGenerator.experienceLetter') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-navy" strokeWidth={1.75} aria-hidden="true" />
            {t('documents.letterGenerator.title')}
          </span>
        }
        className="w-[min(680px,calc(100vw-32px))]"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!selectedEmployee || !letterContent}
              onClick={handleDownload}
            >
              {t('documents.letterGenerator.download')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Template selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink">
              {t('documents.letterGenerator.selectTemplate')}
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTemplateKey(opt.key)}
                  className={[
                    'rounded-[3px] border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    templateKey === opt.key
                      ? 'border-navy bg-navy text-on-navy'
                      : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Employee selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink" htmlFor="lg-employee-select">
              {t('documents.letterGenerator.selectEmployee')}
            </label>
            <select
              id="lg-employee-select"
              value={selectedEmployeeId}
              onChange={(e) =>
                setSelectedEmployeeId(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="h-9 w-full rounded-[3px] border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            >
              <option value="">{t('documents.letterGenerator.selectEmployee')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                  {emp.job_position?.title ? ` — ${emp.job_position.title}` : ''}
                </option>
              ))}
            </select>
            {empState.status === 'pending' && (
              <p className="text-[11px] text-ink-muted">{t('common.loading')}</p>
            )}
          </div>

          {/* Preview */}
          {letterContent && selectedEmployee ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink">
                {t('documents.letterGenerator.preview')}
              </span>
              <LetterPreview
                employee={selectedEmployee}
                content={letterContent}
                company={company}
                previewRef={previewRef}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
