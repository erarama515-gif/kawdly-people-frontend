import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired' | 'pending';

export type DocumentType =
  | 'National ID'
  | 'Passport'
  | 'Work Permit'
  | 'Residence Permit'
  | 'Employment Contract'
  | 'NDA';

export interface HRDocument {
  id: string;
  employeeName: string;
  employeeNameAr: string;
  employeePhoto: string;
  employeeInitials: string;
  documentType: DocumentType;
  documentNumber: string;
  issueDate: string;
  expiryDate: string | null;
  status: DocumentStatus;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

export const hrDocuments: HRDocument[] = [
  {
    id: 'doc1',
    employeeName: 'Ahmed Sami',
    employeeNameAr: 'أحمد سامي',
    employeePhoto: pravatar(53),
    employeeInitials: 'AS',
    documentType: 'Passport',
    documentNumber: 'A12345678',
    issueDate: '2021-04-10',
    expiryDate: '2031-04-09',
    status: 'valid',
  },
  {
    id: 'doc2',
    employeeName: 'Mona Khaled',
    employeeNameAr: 'منى خالد',
    employeePhoto: pravatar(44),
    employeeInitials: 'MK',
    documentType: 'Residence Permit',
    documentNumber: 'RP-2021-003412',
    issueDate: '2021-09-15',
    expiryDate: '2025-10-08',
    status: 'expiring_soon',
  },
  {
    id: 'doc3',
    employeeName: 'Salma Adel',
    employeeNameAr: 'سلمى عادل',
    employeePhoto: pravatar(9),
    employeeInitials: 'SA',
    documentType: 'Work Permit',
    documentNumber: 'WP-EGY-2022-0087',
    issueDate: '2022-06-01',
    expiryDate: '2025-08-31',
    status: 'expired',
  },
  {
    id: 'doc4',
    employeeName: 'Karim Fouad',
    employeeNameAr: 'كريم فؤاد',
    employeePhoto: pravatar(26),
    employeeInitials: 'KF',
    documentType: 'National ID',
    documentNumber: '29901012301234',
    issueDate: '2019-01-02',
    expiryDate: '2029-01-01',
    status: 'valid',
  },
  {
    id: 'doc5',
    employeeName: 'Layla Mostafa',
    employeeNameAr: 'ليلى مصطفى',
    employeePhoto: pravatar(47),
    employeeInitials: 'LM',
    documentType: 'NDA',
    documentNumber: 'NDA-2025-0112',
    issueDate: '2025-10-01',
    expiryDate: null,
    status: 'pending',
  },
  {
    id: 'doc6',
    employeeName: 'Omar Hassan',
    employeeNameAr: 'عمر حسن',
    employeePhoto: pravatar(33),
    employeeInitials: 'OH',
    documentType: 'Employment Contract',
    documentNumber: 'EC-2024-0603',
    issueDate: '2024-06-01',
    expiryDate: '2026-05-31',
    status: 'valid',
  },
];

// ─── Summary stats ─────────────────────────────────────────────────────────────

export const documentStats = {
  total: 3842,
  expiring: 17,
  expired: 5,
  templates: 12,
};

// ─── Label / style maps ────────────────────────────────────────────────────────

export const DOC_STATUS_LABELS: Record<DocumentStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  pending: 'Pending',
};

export const DOC_STATUS_CLASSES: Record<DocumentStatus, string> = {
  valid: 'bg-emerald-50 text-emerald-700',
  expiring_soon: 'bg-orange-50 text-orange-700',
  expired: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-700',
};

// ─── Document type icon colors ─────────────────────────────────────────────────

export const DOC_TYPE_CLASSES: Record<DocumentType, string> = {
  'National ID': 'bg-navy/10 text-navy',
  Passport: 'bg-sky-100 text-sky-700',
  'Work Permit': 'bg-emerald-50 text-emerald-700',
  'Residence Permit': 'bg-purple-50 text-purple-700',
  'Employment Contract': 'bg-amber-50 text-amber-700',
  NDA: 'bg-gray-100 text-gray-600',
};
