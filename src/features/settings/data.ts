/**
 * Typed mock data for the Settings page.
 * Each group maps to a card. A real implementation would fetch these from a
 * /settings API and patch them on change; for now the shape documents what
 * each field stores so backend integration is a straight swap.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingValue = string | number | boolean;

export interface SettingRow {
  id: string;
  label: string;
  value: SettingValue;
  /** Optional description shown below the label */
  description?: string;
  /** When true the value renders as an enabled/disabled badge */
  isToggle?: boolean;
}

export interface SettingGroup {
  id: string;
  title: string;
  rows: SettingRow[];
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export const settingGroups: SettingGroup[] = [
  {
    id: 'general',
    title: 'General',
    rows: [
      { id: 'companyName', label: 'Company Name', value: 'Kawdly Technologies Co.' },
      { id: 'logo', label: 'Logo', value: 'kawdly-logo.svg' },
      { id: 'timezone', label: 'Timezone', value: 'Asia/Riyadh (UTC+3)' },
      { id: 'language', label: 'Default Language', value: 'English' },
      { id: 'fiscalYearStart', label: 'Fiscal Year Start', value: '01 January' },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance',
    rows: [
      {
        id: 'gracePeriod',
        label: 'Grace Period',
        value: '15 minutes',
        description: 'Lateness deducted only beyond this window',
      },
      {
        id: 'overtimeThreshold',
        label: 'Overtime Threshold',
        value: '8 hours / day',
        description: 'Hours after which overtime rate applies',
      },
      {
        id: 'checkInMethods',
        label: 'Check-in Methods',
        value: 'Mobile app, Biometric, Web',
      },
      {
        id: 'weekendDays',
        label: 'Weekend Days',
        value: 'Friday & Saturday',
      },
    ],
  },
  {
    id: 'leave',
    title: 'Leave',
    rows: [
      {
        id: 'annualEntitlement',
        label: 'Annual Entitlement',
        value: '21 days',
        description: 'Per employee per year',
      },
      {
        id: 'carryForwardMax',
        label: 'Carry Forward Maximum',
        value: '5 days',
        description: 'Unused leave allowed into next year',
      },
      {
        id: 'accrualMethod',
        label: 'Accrual Method',
        value: 'Monthly pro-rata',
      },
      {
        id: 'approvalLevels',
        label: 'Approval Levels',
        value: '2 (Manager → HR)',
      },
    ],
  },
  {
    id: 'payroll',
    title: 'Payroll',
    rows: [
      { id: 'payCycle', label: 'Pay Cycle', value: 'Monthly' },
      { id: 'currency', label: 'Currency', value: 'SAR — Saudi Riyal' },
      {
        id: 'taxEnabled',
        label: 'VAT / Tax Deduction',
        value: true,
        isToggle: true,
        description: 'Enabled — 15% VAT applied to payslips',
      },
      { id: 'payDay', label: 'Pay Day', value: '25th of each month' },
      { id: 'overtimeMultiplier', label: 'Overtime Multiplier', value: '1.5×' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    rows: [
      {
        id: 'emailNotifs',
        label: 'Email Notifications',
        value: true,
        isToggle: true,
        description: 'Leave approvals, payslips, contract alerts',
      },
      {
        id: 'smsNotifs',
        label: 'SMS Notifications',
        value: false,
        isToggle: true,
        description: 'Urgent alerts only',
      },
      {
        id: 'inAppNotifs',
        label: 'In-App Notifications',
        value: true,
        isToggle: true,
        description: 'Real-time bell icon alerts',
      },
      {
        id: 'digestFrequency',
        label: 'Digest Frequency',
        value: 'Daily at 08:00',
      },
    ],
  },
];
