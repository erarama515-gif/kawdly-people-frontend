import type { EmployeeWire } from '@/features/employees/api/schema';

/**
 * Letter content sections returned by each template function.
 * Supports both Arabic and English text formatting.
 */
export interface LetterContent {
  title: string;
  body: string;
  closing: string;
  isRtl?: boolean;
}

function formatDateEn(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateAr(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fullName(employee: EmployeeWire): string {
  return `${employee.first_name} ${employee.last_name}`;
}

const FALLBACK_EMPLOYER_EN = 'the Company';
const FALLBACK_EMPLOYER_AR = 'الشركة';

function employer(companyName: string, lang: 'ar' | 'en'): string {
  const trimmed = companyName.trim();
  if (trimmed !== '') return trimmed;
  return lang === 'ar' ? FALLBACK_EMPLOYER_AR : FALLBACK_EMPLOYER_EN;
}

/**
 * Employment Certificate — confirms that the named individual is employed
 * by `companyName` in the stated role.
 */
export function employmentCertificate(
  employee: EmployeeWire,
  companyName: string,
  lang: 'ar' | 'en' = 'ar',
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName, lang);
  const position = employee.job_position?.title ?? (lang === 'ar' ? 'غير محدد' : 'N/A');
  const department = employee.department?.name ?? (lang === 'ar' ? 'غير محدد' : 'N/A');

  if (lang === 'ar') {
    const joinDate = formatDateAr(employee.joining_date);
    const today = formatDateAr(new Date().toISOString());

    return {
      title: 'شهادة إثبات عمل (لمن يهمه الأمر)',
      body: [
        'تحية طيبة وبعد،،',
        '',
        `تشهد إدارة الموارد البشرية بشركة "${company}" بأن السيد / السيدة: ${name}`,
        employee.employee_number ? `الرقم الوظيفي: ${employee.employee_number}` : '',
        `يعمل لدينا بوظيفة: ${position}، في قسم: ${department}`,
        `وذلك اعتباراً من تاريخ التحاقه بالعمل في: ${joinDate} وحتى تاريخه.`,
        '',
        'وهو على رأس عمله ومقيد بسجلات الشركة حتى تاريخ إصدار هذه الشهادة، ويؤدي مهام عمله بكل أمانة وإخلاص وحسن سيرة وسلوك.',
        '',
        'وقد أُعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى الجهات المعنية دون أدنى مسؤولية مالية أو قانونية على الشركة تجاه حقوق الغير.',
      ].filter(Boolean).join('\n'),
      closing: [
        'شاكرين لكم حسن تعاونكم الدائم،،',
        `إدارة الموارد البشرية — ${company}`,
        `تاريخ الإصدار: ${today}`,
      ].join('\n'),
      isRtl: true,
    };
  }

  const joinDate = formatDateEn(employee.joining_date);
  const today = formatDateEn(new Date().toISOString());

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
      `Date of Issue: ${today}`,
    ].join('\n'),
    isRtl: false,
  };
}

/**
 * Salary Certificate — confirms employment and regular monthly compensation.
 */
export function salaryCertificate(
  employee: EmployeeWire,
  companyName: string,
  lang: 'ar' | 'en' = 'ar',
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName, lang);
  const position = employee.job_position?.title ?? (lang === 'ar' ? 'غير محدد' : 'N/A');
  const department = employee.department?.name ?? (lang === 'ar' ? 'غير محدد' : 'N/A');

  if (lang === 'ar') {
    const joinDate = formatDateAr(employee.joining_date);
    const today = formatDateAr(new Date().toISOString());

    return {
      title: 'شهادة مفردات وإثبات دخل شهري',
      body: [
        'إلى من يهمه الأمر،،',
        '',
        `تشهد شركة "${company}" بأن السيد / السيدة: ${name}`,
        employee.employee_number ? `الرقم الوظيفي: ${employee.employee_number}` : '',
        `يعمل لدينا بوظيفة: ${position}، في قسم: ${department}`,
        `اعتباراً من تاريخ: ${joinDate} وحتى تاريخه.`,
        '',
        'ونفيدكم بأنه يتقاضى راتباً شهرياً منتظماً ومحولاً لحسابه البنكي وفقاً لبنود عقد العمل المبرم معه واللوائح المعتمدة بالشركة.',
        '',
        'وقد صدرت هذه الشهادة بناءً على رغبة الموظف لتقديمها للجهات الرسمية والمصرفية دون تحمل الشركة أي كفالة أو مسؤولية مالية تجاه الغير.',
      ].filter(Boolean).join('\n'),
      closing: [
        'وتفضلوا بقبول فائق الاحترام والتقدير،،',
        `إدارة الموارد البشرية — ${company}`,
        `تاريخ الإصدار: ${today}`,
      ].join('\n'),
      isRtl: true,
    };
  }

  const joinDate = formatDateEn(employee.joining_date);
  const today = formatDateEn(new Date().toISOString());

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
      `Date of Issue: ${today}`,
    ].join('\n'),
    isRtl: false,
  };
}

/**
 * Experience Letter — issued upon or in anticipation of departure,
 * summarising the employee's tenure and role at `companyName`.
 */
export function experienceLetter(
  employee: EmployeeWire,
  companyName: string,
  lang: 'ar' | 'en' = 'ar',
): LetterContent {
  const name = fullName(employee);
  const company = employer(companyName, lang);
  const position = employee.job_position?.title ?? (lang === 'ar' ? 'غير محدد' : 'N/A');
  const department = employee.department?.name ?? (lang === 'ar' ? 'غير محدد' : 'N/A');

  if (lang === 'ar') {
    const joinDate = formatDateAr(employee.joining_date);
    const today = formatDateAr(new Date().toISOString());

    return {
      title: 'شهادة خبرة وخدمة عمل',
      body: [
        'تشهد إدارة شركة "${company}" بأن:',
        `السيد / السيدة: ${name}`,
        employee.employee_number ? `الرقم الوظيفي: ${employee.employee_number}` : '',
        `قد عمل لدينا في وظيفة: ${position}، بقسم: ${department}`,
        `وذلك في الفترة من: ${joinDate} وحتى تاريخه.`,
        '',
        'وخلال فترة عمله بالشركة كان مثالاً للأمانة والجدية وحسن السير والسلوك، وأظهر كفاءة ومهارة متميزة وتفانياً في إنجاز المهام الموكلة إليه.',
        '',
        'وقد أُعطيت له هذه الشهادة بناءً على طلبه مع خالص تمنياتنا له بدوام التوفيق والنجاح في مسيرته المهنية المستقبلية.',
      ].filter(Boolean).join('\n'),
      closing: [
        'مع أطيب التحيات والتقدير،،',
        `إدارة الموارد البشرية — ${company}`,
        `تاريخ الإصدار: ${today}`,
      ].join('\n'),
      isRtl: true,
    };
  }

  const joinDate = formatDateEn(employee.joining_date);
  const today = formatDateEn(new Date().toISOString());

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
      `Date of Issue: ${today}`,
    ].join('\n'),
    isRtl: false,
  };
}
