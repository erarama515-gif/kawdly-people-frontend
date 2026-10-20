import type { EmployeeWire } from '@/features/employees/api/schema';

/**
 * Letter content sections returned by each template function.
 * All content is English-only.
 *
 * NOTE (Phase 2): Arabic PDF generation requires embedding a custom Arabic
 * font (e.g. Amiri or Cairo) into jsPDF via `jsPDF.addFileToVFS` +
 * `jsPDF.addFont`. The built-in jsPDF font set does not support Arabic
 * script, so Arabic characters render as garbled boxes until that font
 * embedding step is done.
 */
export interface LetterContent {
  title: string;
  body: string;
  closing: string;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fullName(employee: EmployeeWire): string {
  return `${employee.first_name} ${employee.last_name}`;
}

/**
 * The employer named in the letter body.
 *
 * Every template takes this as an argument rather than hardcoding it. Until
 * T6.5 these three functions said "Kawdly Tech" — the developer's own company —
 * which was invisible in-house and wrong for everybody else: the PDF rendered
 * the real company in the letterhead (buildPdf already drew `company.name`) and
 * then certified, two lines below, that the employee works somewhere else. An
 * external user cannot fix that from Settings, and an employment or experience
 * letter is the kind of document that gets handed to a bank or an embassy.
 *
 * The caller passes the resolved `general.companyName` setting. The fallback
 * below is only reached if that setting is missing or still loading; it is
 * deliberately generic rather than any real company's name.
 */
const FALLBACK_EMPLOYER = 'the Company';

function employer(companyName: string): string {
  const trimmed = companyName.trim();
  return trimmed === '' ? FALLBACK_EMPLOYER : trimmed;
}

/**
 * Employment Certificate — confirms that the named individual is employed
 * by `companyName` in the stated role.
 */
export function employmentCertificate(
  employee: EmployeeWire,
  companyName: string,
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName);
  const position = employee.job_position?.title ?? 'N/A';
  const department = employee.department?.name ?? 'N/A';
  const joinDate = formatDate(employee.joining_date);

  return {
    title: 'EMPLOYMENT CERTIFICATE',
    body: [
      'To Whom It May Concern,',
      '',
      `This is to certify that ${name} has been employed with ${company} since ${joinDate}`,
      `in the position of ${position}, within the ${department} department.`,
      '',
      'This employee is currently in good standing with the company and fulfills',
      'all duties and responsibilities associated with their role.',
      '',
      'This certificate is issued upon request and for the exclusive use of the',
      'employee named above.',
    ].join('\n'),
    closing: [
      'Issued in good faith by the Human Resources Department.',
      `Date of Issue: ${formatDate(new Date().toISOString())}`,
    ].join('\n'),
  };
}

/**
 * Salary Certificate — confirms employment and states that the employee
 * receives a monthly salary (amount intentionally omitted until payroll
 * integration is available in a later sprint).
 */
export function salaryCertificate(
  employee: EmployeeWire,
  companyName: string,
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName);
  const position = employee.job_position?.title ?? 'N/A';
  const department = employee.department?.name ?? 'N/A';
  const joinDate = formatDate(employee.joining_date);

  return {
    title: 'SALARY CERTIFICATE',
    body: [
      'To Whom It May Concern,',
      '',
      `This is to certify that ${name} is currently employed at ${company}`,
      `as ${position} in the ${department} department, effective ${joinDate}.`,
      '',
      'The employee receives a regular monthly salary as per the terms of their',
      'employment contract. Detailed salary information may be provided upon',
      'an official request through the HR department.',
      '',
      'This certificate is issued upon request and for official purposes only.',
    ].join('\n'),
    closing: [
      'Issued in good faith by the Human Resources Department.',
      `Date of Issue: ${formatDate(new Date().toISOString())}`,
    ].join('\n'),
  };
}

/**
 * Experience Letter — issued upon or in anticipation of departure,
 * summarising the employee's tenure and role at `companyName`.
 */
export function experienceLetter(
  employee: EmployeeWire,
  companyName: string,
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName);
  const position = employee.job_position?.title ?? 'N/A';
  const department = employee.department?.name ?? 'N/A';
  const joinDate = formatDate(employee.joining_date);

  return {
    title: 'EXPERIENCE LETTER',
    body: [
      'To Whom It May Concern,',
      '',
      `This letter is to confirm that ${name} has been associated with ${company}`,
      `from ${joinDate} in the capacity of ${position}, ${department} department.`,
      '',
      'During their tenure, the employee demonstrated professionalism and',
      'dedication in carrying out their responsibilities. They have been a valued',
      'member of our team and we wish them the very best in their future endeavours.',
      '',
      'We hereby confirm that the above information is true to the best of our',
      'knowledge and records.',
    ].join('\n'),
    closing: [
      'Issued in good faith by the Human Resources Department.',
      `Date of Issue: ${formatDate(new Date().toISOString())}`,
    ].join('\n'),
  };
}
