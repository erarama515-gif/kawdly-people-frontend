import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useEmployeeList } from '@/features/employees/api/queries';
import type { EmployeeWire } from '@/features/employees/api/schema';
import { useSettingList } from '@/features/settings/api/queries';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import {
  employmentCertificate,
  salaryCertificate,
  experienceLetter,
} from './letterTemplates';
import type { LetterContent } from './letterTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateKey = 'employmentCert' | 'salaryCert' | 'experienceLetter';
type LetterLang = 'ar' | 'en';

// ─── Company info ─────────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
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

// ─── Preview renderer ─────────────────────────────────────────────────────────

interface LetterPreviewProps {
  employee: EmployeeWire;
  content: LetterContent;
  company: CompanyInfo;
  previewRef?: React.RefObject<HTMLDivElement>;
}

function LetterPreview({ content, company, previewRef }: LetterPreviewProps) {
  const isRtl = content.isRtl ?? false;

  return (
    <div
      ref={previewRef}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={cn(
        'rounded-[4px] border border-hairline bg-white p-8 text-[12px] leading-relaxed text-ink shadow-sm',
        isRtl ? 'font-sans text-right' : 'font-sans text-left',
      )}
    >
      {/* Header */}
      <div className="mb-6 border-b border-hairline pb-4">
        <p className="text-[16px] font-bold text-navy">{company.name}</p>
        <p className="text-[12px] text-ink-muted">
          {isRtl ? 'إدارة الموارد البشرية' : 'Human Resources Department'}
        </p>
        {company.email ? <p className="text-[11px] text-ink-muted">{company.email}</p> : null}
      </div>

      {/* Title banner */}
      <div className="my-5 rounded border border-navy/20 bg-navy/5 py-2.5 text-center">
        <h2 className="text-[14px] font-bold tracking-wide text-navy">
          {content.title}
        </h2>
      </div>

      {/* Body text */}
      <div className="my-6 whitespace-pre-wrap text-[12px] font-medium leading-[2] text-ink">
        {content.body}
      </div>

      {/* Closing & Signatures */}
      <div className="mt-8 border-t border-hairline pt-4">
        <div className="whitespace-pre-wrap text-[11px] text-ink-muted">
          {content.closing}
        </div>
        <div className="mt-8 flex justify-between items-end">
          <div>
            <div className="mb-2 w-48 border-b border-ink-muted" />
            <p className="text-[11px] font-semibold text-ink">
              {isRtl ? 'التوقيع والختم المعتمد' : 'Authorised Signature'}
            </p>
            <p className="text-[11px] text-ink-muted">
              {isRtl ? `إدارة الموارد البشرية — ${company.name}` : `HR Department — ${company.name}`}
            </p>
          </div>
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
  const { t, i18n } = useTranslation();

  const [templateKey, setTemplateKey] = useState<TemplateKey>('employmentCert');
  const [letterLang, setLetterLang] = useState<LetterLang>(
    i18n.language.startsWith('en') ? 'en' : 'ar',
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all employees for the dropdown
  const { state: empState } = useEmployeeList({ perPage: 200 });
  const employees: EmployeeWire[] = empState.data?.data ?? [];

  // Fetch dynamic company info from settings API
  const company = useCompanyInfo();

  // Ref for the letter DOM element to capture via html2canvas
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const letterContent: LetterContent | null = useMemo(() => {
    if (!selectedEmployee) return null;
    if (templateKey === 'employmentCert') {
      return employmentCertificate(selectedEmployee, company.rawName, letterLang);
    }
    if (templateKey === 'salaryCert') {
      return salaryCertificate(selectedEmployee, company.rawName, letterLang);
    }
    return experienceLetter(selectedEmployee, company.rawName, letterLang);
  }, [templateKey, selectedEmployee, company.rawName, letterLang]);

  async function handleDownload() {
    if (!selectedEmployee || !letterContent || !previewRef.current) return;

    try {
      setIsGenerating(true);

      const element = previewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // 2x DPI for crisp print quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const targetWidth = pageWidth - margin * 2;
      const targetHeight = (canvas.height * targetWidth) / canvas.width;

      doc.addImage(
        imgData,
        'PNG',
        margin,
        margin,
        targetWidth,
        Math.min(targetHeight, pageHeight - margin * 2),
      );

      const safeName = `${selectedEmployee.first_name}_${selectedEmployee.last_name}`
        .toLowerCase()
        .replace(/\s+/g, '_');

      doc.save(`${templateKey}_${safeName}_${letterLang}.pdf`);
      toast.success(letterLang === 'ar' ? 'تم إنشاء وتحميل الخطاب بنجاح' : 'Letter PDF downloaded successfully');
    } catch (err) {
      console.error('Failed to export letter PDF:', err);
      toast.error(letterLang === 'ar' ? 'حدث خطأ أثناء إنشاء المستند' : 'Failed to generate PDF document');
    } finally {
      setIsGenerating(false);
    }
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
        className="w-[min(720px,calc(100vw-32px))]"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!selectedEmployee || !letterContent || isGenerating}
              onClick={() => void handleDownload()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('documents.letterGenerator.generating')}
                </>
              ) : (
                t('documents.letterGenerator.download')
              )}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Controls: Template + Language */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Template selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink">
                {t('documents.letterGenerator.selectTemplate')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTemplateKey(opt.key)}
                    className={cn(
                      'rounded-[3px] border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                      templateKey === opt.key
                        ? 'border-navy bg-navy text-on-navy'
                        : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-ink">
                {t('documents.letterGenerator.selectLanguage')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLetterLang('ar')}
                  className={cn(
                    'flex-1 rounded-[3px] border px-3 py-1 text-[12px] font-semibold transition-colors text-center',
                    letterLang === 'ar'
                      ? 'border-navy bg-navy text-on-navy'
                      : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
                  )}
                >
                  {t('documents.letterGenerator.langArabic')}
                </button>
                <button
                  type="button"
                  onClick={() => setLetterLang('en')}
                  className={cn(
                    'flex-1 rounded-[3px] border px-3 py-1 text-[12px] font-semibold transition-colors text-center',
                    letterLang === 'en'
                      ? 'border-navy bg-navy text-on-navy'
                      : 'border-hairline bg-surface text-ink-muted hover:border-navy/40 hover:text-ink',
                  )}
                >
                  {t('documents.letterGenerator.langEnglish')}
                </button>
              </div>
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
