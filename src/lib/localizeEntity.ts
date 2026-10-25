import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

/**
 * Standard localization map for seeded and commonly-used organizational,
 * leave, compensation, and payroll terms when backend names are stored in English.
 */
const SEED_TRANSLATIONS: Record<string, string> = {
  // Leave Types
  'annual': 'إجازة سنوية',
  'annual leave': 'إجازة سنوية',
  'sick': 'إجازة مرضية',
  'sick leave': 'إجازة مرضية',
  'emergency': 'إجازة عارضة',
  'emergency leave': 'إجازة عارضة',
  'unpaid': 'إجازة بدون راتب',
  'unpaid leave': 'إجازة بدون راتب',
  'maternity': 'إجازة وضع',
  'maternity leave': 'إجازة وضع',
  'paternity': 'إجازة رعاية طفل',
  'paternity leave': 'إجازة رعاية طفل',
  'hajj': 'إجازة حج',
  'bereavement': 'إجازة وفاة',

  // Departments
  'sales': 'المبيعات',
  'operations': 'العمليات',
  'it': 'تقنية المعلومات',
  'information technology': 'تقنية المعلومات',
  'finance': 'المالية',
  'hr': 'الموارد البشرية',
  'human resources': 'الموارد البشرية',
  'marketing': 'التسويق',
  'legal': 'الشؤون القانونية',
  'admin': 'الإدارة العامة',
  'administration': 'الإدارة العامة',
  'engineering': 'الهندسة',
  'customer support': 'خدمة العملاء',

  // Branches
  'cairo hq': 'فرع القاهرة (المقر الرئيسي)',
  'cairo': 'القاهرة',
  'riyadh': 'الرياض',
  'dubai': 'دبي',
  'alexandria': 'الإسكندرية',

  // Job Levels
  'junior': 'مبتدئ',
  'mid-level': 'متوسط',
  'mid level': 'متوسط',
  'senior': 'أول / متقدم',
  'lead': 'قائد فريق',
  'principal': 'رئيسي',
  'director': 'مدير إدارة',

  // Job Grades
  'associate': 'مشارك',
  'professional': 'مهني',
  'senior professional': 'مهني متقدم',
  'lead / manager': 'قائد / مدير',
  'senior manager': 'مدير أول',

  // Job Positions
  'sales executive': 'مسؤول مبيعات',
  'sales manager': 'مدير مبيعات',
  'sales associate': 'مساعد مبيعات',
  'senior developer': 'مطور أول',
  'devops engineer': 'مهندس DevOps',
  'junior developer': 'مطور مبتدئ',
  'financial analyst': 'محلل مالي',
  'finance associate': 'مساعد مالي',
  'hr specialist': 'أخصائي موارد بشرية',
  'ux designer': 'مصمم تجربة مستخدم',
  'marketing coordinator': 'منسق تسويق',
  'legal counsel': 'مستشار قانوني',
  'operations manager': 'مدير العمليات',
  'admin officer': 'موظف إداري',

  // Salary Components
  'basic salary': 'الراتب الأساسي',
  'housing allowance': 'بدل سكن',
  'transportation allowance': 'بدل انتقال',
  'transport allowance': 'بدل انتقال',
  'mobile allowance': 'بدل هاتف',
  'food allowance': 'بدل وجبة',
  'overtime': 'ساعات إضافية',
  'bonus': 'مكافأة',
  'performance bonus': 'مكافأة أداء',
  'commission': 'عمولة',
  'social insurance': 'التأمينات الاجتماعية',
  'income tax': 'ضريبة الدخل',
  'gosi': 'التأمينات الاجتماعية (GOSI)',
  'health insurance': 'التأمين الصحي',
  'standard monthly': 'هيكل الراتب الشهري القياسي',
  'sales commission structure': 'هيكل عمولات المبيعات',

  // Contract & Document Types
  'passport': 'جواز السفر',
  'national id': 'بطاقة الرقم القومي / الهوية الوطنية',
  'id card': 'بطاقة الهوية',
  'driving license': 'رخصة القيادة',
  'graduation certificate': 'شهادة التخرج / المؤهل الدراسي',
  'employment contract': 'عقد العمل',
  'nda': 'اتفاقية عدم الإفصاح (NDA)',
  'full-time': 'دوام كامل',
  'part-time': 'دوام جزئي',
  'contract': 'عقد محدد المدة',
  'internship': 'تدريب',
};

/**
 * Localizes an entity name if the current language is Arabic and an entry exists.
 */
export function localizeEntity(name: string | null | undefined, language: string = 'ar'): string {
  if (!name) return '';
  if (language.startsWith('en')) return name;

  const key = name.trim().toLowerCase();
  return SEED_TRANSLATIONS[key] ?? name;
}

/**
 * React hook returning a memoized helper for localizing entity names in the active language.
 */
export function useLocalizeEntity() {
  const { i18n } = useTranslation();
  const lang = i18n.language ?? 'ar';

  return useMemo(() => {
    return (name: string | null | undefined): string => localizeEntity(name, lang);
  }, [lang]);
}
