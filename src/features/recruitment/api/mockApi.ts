import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { DEPARTMENTS } from '@/features/employees/orgLookup';
import { jobPostingDecoder, jobPostingListDecoder } from './schema';
import type { JobPostingListWire, JobPostingWire } from './schema';
import type {
  JobPostingApi,
  JobPostingEmploymentType,
  JobPostingStatus,
} from './resource';

/**
 * In-process implementation of `JobPostingApi`, used until the Laravel backend
 * is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `employees/api/mockApi.ts`: owns real mutable state so a create or
 * delete is a genuine write that later reads observe, adds latency, honours
 * `AbortSignal`, and every response is re-decoded through the same decoders a
 * real HTTP response would go through, so the two transports are
 * indistinguishable to the rest of the app.
 *
 * `status` is stored as a real field here (not derived) so search/filter work
 * without re-computing booleans. On a real API call, `client.ts` computes it
 * from `is_published` + `expires_at` before decoding.
 */

interface StoredJobPosting {
  id: number;
  uuid: string;
  job_requisition_id?: number | null | undefined;
  title: string;
  description: string;
  requirements?: string | undefined;
  skills: string[];
  experience_min?: number | undefined;
  experience_max?: number | undefined;
  education_level?: string | undefined;
  salary_min?: number | undefined;
  salary_max?: number | undefined;
  location?: string | undefined;
  employment_type: JobPostingEmploymentType;
  is_internal: boolean;
  is_published: boolean;
  published_at?: string | undefined;
  expires_at?: string | undefined;
  /** Synthetic — stored so mock filter/search is consistent with the UI. */
  status: JobPostingStatus;
  created_at: string;
  updated_at: string;
}

const EMPLOYMENT_TYPES: JobPostingEmploymentType[] = [
  'full_time', 'full_time', 'full_time', 'part_time', 'contract', 'intern',
];

const JOB_TITLES = [
  'Senior Software Engineer',
  'Product Manager',
  'Financial Analyst',
  'UX Designer',
  'HR Business Partner',
  'DevOps Engineer',
  'Marketing Coordinator',
  'Operations Manager',
  'Sales Executive',
  'Legal Counsel',
  'Data Analyst',
  'Junior Developer',
  'Admin Officer',
  'HR Specialist',
  'Sales Manager',
] as const;

const SKILL_POOL = [
  ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  ['Product Strategy', 'Roadmapping', 'SQL', 'Figma'],
  ['Excel', 'Financial Modelling', 'Power BI', 'SAP'],
  ['Figma', 'User Research', 'Prototyping', 'CSS'],
  ['HRIS', 'Labour Law', 'Talent Acquisition', 'Onboarding'],
  ['Docker', 'Kubernetes', 'CI/CD', 'AWS'],
  ['Content Writing', 'SEO', 'Social Media', 'Analytics'],
  ['ERP', 'Supply Chain', 'Process Improvement', 'Six Sigma'],
  ['CRM', 'Negotiation', 'Presentation', 'B2B Sales'],
  ['Contract Drafting', 'Corporate Law', 'Due Diligence', 'Compliance'],
  ['Python', 'SQL', 'Tableau', 'Machine Learning'],
  ['JavaScript', 'Vue.js', 'HTML/CSS', 'Git'],
  ['Office 365', 'Document Management', 'Scheduling'],
  ['Recruitment', 'ATS', 'Interview Techniques', 'HRIS'],
  ['Salesforce', 'Team Leadership', 'KPI Management', 'B2C Sales'],
];

const LOCATIONS = [
  'Cairo, Egypt', 'Riyadh, KSA', 'Dubai, UAE', 'Remote', 'Cairo, Egypt',
];

const STATUSES: JobPostingStatus[] = ['open', 'open', 'open', 'open', 'closed', 'draft'];

/** Deterministic anchor records — the six entries originally displayed by the old static mock. */
const ANCHORS: StoredJobPosting[] = [
  posting(1, 1, 'Senior Software Engineer', 3, 0, 'open', '2026-09-10'),
  posting(2, 2, 'Product Manager', 2, 1, 'open', '2026-09-14'),
  posting(3, 3, 'Financial Analyst', 4, 2, 'open', '2026-09-02'),
  posting(4, 4, 'UX Designer', 6, 3, 'closed', '2026-08-18', '2026-09-30'),
  posting(5, 5, 'HR Business Partner', 5, 4, 'draft', undefined),
  posting(6, 6, 'DevOps Engineer', 3, 5, 'open', '2026-09-20'),
];

function posting(
  id: number,
  requisitionId: number,
  title: string,
  departmentIndex: number,
  skillSetIndex: number,
  status: JobPostingStatus,
  publishedAt: string | undefined,
  expiresAt?: string,
): StoredJobPosting {
  const isPublished = status !== 'draft';
  const stamp = publishedAt ?? new Date().toISOString().slice(0, 10);
  return {
    id,
    uuid: `11000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    job_requisition_id: requisitionId,
    title,
    description: `We are looking for a talented ${title} to join our ${DEPARTMENTS[departmentIndex % DEPARTMENTS.length].name} team.`,
    skills: SKILL_POOL[skillSetIndex % SKILL_POOL.length],
    employment_type: EMPLOYMENT_TYPES[id % EMPLOYMENT_TYPES.length],
    location: LOCATIONS[id % LOCATIONS.length],
    is_internal: id % 5 === 0,
    is_published: isPublished,
    published_at: isPublished ? `${stamp}T08:00:00.000Z` : undefined,
    expires_at: expiresAt ? `${expiresAt}T23:59:59.000Z` : undefined,
    status,
    created_at: `${stamp}T08:00:00.000Z`,
    updated_at: `${stamp}T08:00:00.000Z`,
  };
}

/** Deterministic filler so pagination (and search/filter) has something to page through. */
function generateFiller(count: number, startId: number): StoredJobPosting[] {
  const rows: StoredJobPosting[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const titleIndex = index % JOB_TITLES.length;
    const title = JOB_TITLES[titleIndex];
    const departmentIndex = index % DEPARTMENTS.length;
    const status = STATUSES[index % STATUSES.length];
    const isPublished = status !== 'draft';
    const year = 2025 + (index % 2);
    const month = String(1 + (index % 12)).padStart(2, '0');
    const day = String(1 + (index % 27)).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    rows.push({
      id,
      uuid: `11000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      job_requisition_id: id,
      title,
      description: `We are looking for a talented ${title} to join our ${DEPARTMENTS[departmentIndex].name} team.`,
      requirements: index % 3 === 0 ? `${index + 2}+ years of relevant experience required.` : undefined,
      skills: SKILL_POOL[titleIndex % SKILL_POOL.length],
      experience_min: index % 4 === 0 ? undefined : 1 + (index % 6),
      experience_max: index % 4 === 0 ? undefined : 3 + (index % 8),
      education_level: index % 3 === 0 ? "Bachelor's Degree" : index % 3 === 1 ? "Master's Degree" : undefined,
      salary_min: index % 5 === 0 ? undefined : 5000 + (index % 10) * 1000,
      salary_max: index % 5 === 0 ? undefined : 8000 + (index % 10) * 1500,
      location: LOCATIONS[index % LOCATIONS.length],
      employment_type: EMPLOYMENT_TYPES[index % EMPLOYMENT_TYPES.length],
      is_internal: index % 7 === 0,
      is_published: isPublished,
      published_at: isPublished ? `${dateStr}T08:00:00.000Z` : undefined,
      expires_at: status === 'closed' ? `${year}-${month}-28T23:59:59.000Z` : undefined,
      status,
      created_at: `${dateStr}T08:00:00.000Z`,
      updated_at: `${dateStr}T08:00:00.000Z`,
    });
  }
  return rows;
}

function seed(): StoredJobPosting[] {
  return [...ANCHORS, ...generateFiller(18, 100)];
}

let store: StoredJobPosting[] = seed();
let nextId = 500;

export function resetMockJobPostings(): void {
  store = seed();
  nextId = 500;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.jobPostingsMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockJobPostingFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockJobPostingApi: JobPostingApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (!search) return true;
      const haystack = `${row.title} ${row.location ?? ''}`.toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: JobPostingListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return jobPostingListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const isPublished = input.is_published ?? false;
    const expiresAt = input.expires_at ?? undefined;
    const status: JobPostingStatus = !isPublished ? 'draft' :
      (expiresAt && new Date(expiresAt) < new Date()) ? 'closed' : 'open';

    const row: StoredJobPosting = {
      id,
      uuid: `11000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
      job_requisition_id: input.job_requisition_id ?? undefined,
      title: input.title,
      description: input.description,
      requirements: input.requirements ?? undefined,
      skills: input.skills,
      experience_min: input.experience_min ?? undefined,
      experience_max: input.experience_max ?? undefined,
      education_level: input.education_level ?? undefined,
      salary_min: input.salary_min ?? undefined,
      salary_max: input.salary_max ?? undefined,
      location: input.location ?? undefined,
      employment_type: input.employment_type,
      is_internal: input.is_internal ?? false,
      is_published: isPublished,
      published_at: input.published_at ?? undefined,
      expires_at: expiresAt,
      status,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return jobPostingDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const isPublished = input.is_published !== undefined ? (input.is_published ?? false) : row.is_published;
    const expiresAt = input.expires_at !== undefined ? (input.expires_at ?? undefined) : row.expires_at;
    const status: JobPostingStatus = !isPublished ? 'draft' :
      (expiresAt && new Date(expiresAt) < new Date()) ? 'closed' : 'open';

    const updated: StoredJobPosting = {
      ...row,
      ...stripUndefined(input),
      job_requisition_id: input.job_requisition_id === null ? undefined : (input.job_requisition_id ?? row.job_requisition_id),
      requirements: input.requirements === null ? undefined : (input.requirements ?? row.requirements),
      experience_min: input.experience_min === null ? undefined : (input.experience_min ?? row.experience_min),
      experience_max: input.experience_max === null ? undefined : (input.experience_max ?? row.experience_max),
      education_level: input.education_level === null ? undefined : (input.education_level ?? row.education_level),
      salary_min: input.salary_min === null ? undefined : (input.salary_min ?? row.salary_min),
      salary_max: input.salary_max === null ? undefined : (input.salary_max ?? row.salary_max),
      location: input.location === null ? undefined : (input.location ?? row.location),
      published_at: input.published_at === null ? undefined : (input.published_at ?? row.published_at),
      expires_at: input.expires_at === null ? undefined : (input.expires_at ?? row.expires_at),
      is_internal: input.is_internal === null ? false : (input.is_internal ?? row.is_internal),
      is_published: isPublished,
      status,
      updated_at: new Date().toISOString(),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return jobPostingDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },
};

function toWire(row: StoredJobPosting): JobPostingWire {
  return row as unknown as JobPostingWire;
}

function findOrThrow(id: number): StoredJobPosting {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `Job posting ${id} not found`, { status: 404 });
  return row;
}

function stripUndefined<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/** Simulated network delay that rejects promptly when the caller aborts. */
async function simulate(context: FetchContext, baseMs: number): Promise<void> {
  if (context.signal.aborted) throw new ApiError('aborted', 'Request aborted');
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError('network', 'Simulated transport failure');
  }

  const jittered = baseMs + Math.random() * baseMs * 0.4;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted'));
    }
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
}
