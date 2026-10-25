import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Building2, Check, Network, SkipForward, UserPlus } from 'lucide-react';
import { Brand } from '@/components/layout/Brand';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/form/Field';
import { Input } from '@/components/ui/form/Input';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { userFacingMessage } from '@/lib/api/errors';
import { completeSetup, useSetupStatus } from '../api/setup';

/**
 * First-run wizard (Sprint A / A1.6).
 *
 * Three steps, each writing through the endpoint the corresponding feature
 * already owns - company profile (`PATCH /organization/companies/{id}`),
 * departments (`POST /organization/departments`) and team accounts
 * (`POST /users`) - so nothing here duplicates validation or permissions.
 *
 * The wizard is deliberately skippable. A founder who wants to look around
 * first can dismiss it; the workspace stays "not set up" and the Settings
 * screen still offers the same three steps.
 */

type Step = 0 | 1 | 2;

interface DepartmentRow {
  id: number;
  name: string;
  code?: string | null;
  is_active?: boolean | null;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
}

const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR'] as const;

const TEAM_ROLES = [
  'hr_manager',
  'hr_officer',
  'payroll_manager',
  'recruiter',
  'department_manager',
  'employee',
] as const;

const MIN_PASSWORD = 8;

export function SetupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const { state } = useSetupStatus();
  const status = state.data ?? null;

  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepDone, setStepDone] = useState({ company: false, structure: false, team: false });

  // ── Step 1: company profile ────────────────────────────────────────────
  const [company, setCompany] = useState({
    name: '',
    name_ar: '',
    email: '',
    phone: '',
    currency_code: 'EGP',
  });

  useEffect(() => {
    if (!status?.company) return;
    setCompany((current) => ({
      name: current.name || status.company?.name || '',
      name_ar: current.name_ar || status.company?.name_ar || '',
      email: current.email || status.company?.email || '',
      phone: current.phone || status.company?.phone || '',
      currency_code: current.currency_code || status.company?.currency_code || 'EGP',
    }));
  }, [status?.company]);

  // ── Step 2: departments ───────────────────────────────────────────────
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [department, setDepartment] = useState({ name: '', code: '' });

  const loadDepartments = useCallback(async () => {
    if (!status?.company) return;
    try {
      const response = await http<{ data: DepartmentRow[] }>('/departments', {
        method: 'GET',
        query: { per_page: 100 },
      });
      setDepartments(response.data?.data ?? []);
    } catch {
      setDepartments([]);
    }
  }, [status?.company]);

  useEffect(() => {
    if (step === 1) void loadDepartments();
  }, [step, loadDepartments]);

  // ── Step 3: team ──────────────────────────────────────────────────────
  const [teammate, setTeammate] = useState({
    name: '',
    email: '',
    password: '',
    role: 'hr_manager',
  });
  const [invited, setInvited] = useState<UserRow[]>([]);

  const steps = useMemo(
    () => [
      { icon: Building2, label: t('setup.steps.company'), done: stepDone.company },
      { icon: Network, label: t('setup.steps.structure'), done: stepDone.structure },
      { icon: UserPlus, label: t('setup.steps.team'), done: stepDone.team },
    ],
    [t, stepDone],
  );

  async function saveCompany() {
    if (!status?.company) return;
    if (!company.name.trim()) {
      setError(t('setup.validation.companyName'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await http(`/companies/${status.company.id}`, {
        method: 'PATCH',
        body: {
          name: company.name.trim(),
          name_ar: company.name_ar.trim() || null,
          email: company.email.trim() || null,
          phone: company.phone.trim() || null,
          currency_code: company.currency_code,
        },
      });
      setStepDone((current) => ({ ...current, company: true }));
      setStep(1);
    } catch (caught) {
      setError(userFacingMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addDepartment() {
    if (!status?.company) return;
    if (!department.name.trim()) {
      setError(t('setup.validation.departmentName'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await http('/departments', {
        method: 'POST',
        body: {
          company_id: status.company.id,
          name: department.name.trim(),
          code: department.code.trim() || null,
          is_active: true,
        },
      });
      setDepartment({ name: '', code: '' });
      await loadDepartments();
      setStepDone((current) => ({ ...current, structure: true }));
    } catch (caught) {
      setError(userFacingMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addTeammate() {
    if (!teammate.name.trim() || !teammate.email.trim()) {
      setError(t('setup.validation.teamRequired'));
      return;
    }
    if (teammate.password.length < MIN_PASSWORD) {
      setError(t('setup.validation.password'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await http<{ data: UserRow }>('/users', {
        method: 'POST',
        body: {
          name: teammate.name.trim(),
          email: teammate.email.trim(),
          password: teammate.password,
          role: teammate.role,
        },
      });

      const created = response.data?.data;
      setInvited((current) => [
        ...current,
        created ?? { id: 0, name: teammate.name.trim(), email: teammate.email.trim() },
      ]);
      setTeammate({ name: '', email: '', password: '', role: teammate.role });
      setStepDone((current) => ({ ...current, team: true }));
    } catch (caught) {
      setError(userFacingMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function finish(skipped: boolean) {
    setBusy(true);
    setError(null);
    try {
      await completeSetup({ skipped });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(userFacingMessage(caught));
      setBusy(false);
    }
  }

  if (state.status === 'pending') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
      </div>
    );
  }

  if (!status || !status.can_manage) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-body text-ink">{t('setup.notAllowed')}</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/', { replace: true })}>
            {t('setup.backToDashboard')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'en'}
      className="min-h-screen bg-page pb-16"
    >
      <header className="mx-auto flex w-full max-w-[860px] items-center justify-between px-4 py-6">
        <Brand />
        <button
          type="button"
          className="text-caption text-ink-muted hover:text-ink"
          onClick={() => void finish(true)}
          disabled={busy}
        >
          <span className="inline-flex items-center gap-1.5">
            <SkipForward className="h-3.5 w-3.5" />
            {t('setup.skip')}
          </span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-4">
        <h1 className="text-h2 font-semibold text-ink">{t('setup.title')}</h1>
        <p className="mt-1 text-body text-ink-muted">{t('setup.subtitle')}</p>

        <ol className="mt-6 flex items-center gap-2">
          {steps.map((entry, index) => {
            const active = index === step;
            return (
              <li key={entry.label} className="flex flex-1 items-center gap-2">
                <span
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-caption',
                    active
                      ? 'border-navy bg-navy text-on-navy'
                      : entry.done
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-hairline bg-surface text-ink-muted',
                  ].join(' ')}
                >
                  {entry.done && !active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={active ? 'text-caption font-semibold text-ink' : 'text-caption text-ink-muted'}>
                  {entry.label}
                </span>
                {index < steps.length - 1 ? <span className="h-px flex-1 bg-hairline" /> : null}
              </li>
            );
          })}
        </ol>

        <Card className="mt-5 p-6">
          {error ? (
            <div role="alert" className="mb-4 rounded-[3px] border border-coral/40 bg-coral/5 px-3 py-2 text-caption text-coral">
              {error}
            </div>
          ) : null}

          {step === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('setup.company.name')} htmlFor="setup-company-name" required>
                  <Input
                    id="setup-company-name"
                    value={company.name}
                    onChange={(event) => setCompany({ ...company, name: event.target.value })}
                    autoFocus
                  />
                </Field>
                <Field label={t('setup.company.nameAr')} htmlFor="setup-company-name-ar">
                  <Input
                    id="setup-company-name-ar"
                    dir="rtl"
                    value={company.name_ar}
                    onChange={(event) => setCompany({ ...company, name_ar: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.company.email')} htmlFor="setup-company-email">
                  <Input
                    id="setup-company-email"
                    type="email"
                    dir="ltr"
                    value={company.email}
                    onChange={(event) => setCompany({ ...company, email: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.company.phone')} htmlFor="setup-company-phone">
                  <Input
                    id="setup-company-phone"
                    dir="ltr"
                    value={company.phone}
                    onChange={(event) => setCompany({ ...company, phone: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.company.currency')} htmlFor="setup-company-currency">
                  <select
                    id="setup-company-currency"
                    className="h-9 rounded-[3px] border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
                    value={company.currency_code}
                    onChange={(event) => setCompany({ ...company, currency_code: event.target.value })}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" isLoading={busy} onClick={() => void saveCompany()}>
                  {t('setup.next')}
                  <ArrowLeft className="ms-1.5 h-4 w-4 rtl:hidden" />
                  <ArrowRight className="ms-1.5 hidden h-4 w-4 rtl:block" />
                </Button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <p className="text-caption text-ink-muted">{t('setup.structure.hint')}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto]">
                <Field label={t('setup.structure.name')} htmlFor="setup-department-name">
                  <Input
                    id="setup-department-name"
                    value={department.name}
                    onChange={(event) => setDepartment({ ...department, name: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.structure.code')} htmlFor="setup-department-code">
                  <Input
                    id="setup-department-code"
                    dir="ltr"
                    value={department.code}
                    onChange={(event) => setDepartment({ ...department, code: event.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <Button variant="secondary" isLoading={busy} onClick={() => void addDepartment()}>
                    {t('setup.structure.add')}
                  </Button>
                </div>
              </div>

              <ul className="divide-y divide-hairline rounded-[3px] border border-hairline">
                {departments.length === 0 ? (
                  <li className="px-3 py-4 text-caption text-ink-muted">{t('setup.structure.empty')}</li>
                ) : (
                  departments.map((row) => (
                    <li key={row.id} className="flex items-center justify-between px-3 py-2 text-body">
                      <span className="text-ink">{row.name}</span>
                      <span className="text-caption text-ink-faint">{row.code ?? ''}</span>
                    </li>
                  ))
                )}
              </ul>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  {t('setup.back')}
                </Button>
                <Button
                  variant="primary"
                  disabled={departments.length === 0}
                  onClick={() => {
                    setStepDone((current) => ({ ...current, structure: true }));
                    setStep(2);
                  }}
                >
                  {t('setup.next')}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <p className="text-caption text-ink-muted">{t('setup.team.hint')}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('setup.team.name')} htmlFor="setup-team-name" required>
                  <Input
                    id="setup-team-name"
                    value={teammate.name}
                    onChange={(event) => setTeammate({ ...teammate, name: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.team.email')} htmlFor="setup-team-email" required>
                  <Input
                    id="setup-team-email"
                    type="email"
                    dir="ltr"
                    value={teammate.email}
                    onChange={(event) => setTeammate({ ...teammate, email: event.target.value })}
                  />
                </Field>
                <Field label={t('setup.team.role')} htmlFor="setup-team-role">
                  <select
                    id="setup-team-role"
                    className="h-9 rounded-[3px] border border-hairline bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
                    value={teammate.role}
                    onChange={(event) => setTeammate({ ...teammate, role: event.target.value })}
                  >
                    {TEAM_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`setup.roles.${role}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t('setup.team.password')}
                  htmlFor="setup-team-password"
                  hint={t('setup.team.passwordHint')}
                  required
                >
                  <Input
                    id="setup-team-password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={teammate.password}
                    onChange={(event) => setTeammate({ ...teammate, password: event.target.value })}
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button variant="secondary" isLoading={busy} onClick={() => void addTeammate()}>
                  {t('setup.team.add')}
                </Button>
                <p className="text-caption text-ink-faint">{t('setup.team.count', { count: invited.length })}</p>
              </div>

              {invited.length > 0 ? (
                <ul className="divide-y divide-hairline rounded-[3px] border border-hairline">
                  {invited.map((row) => (
                    <li key={`${row.id}-${row.email}`} className="flex items-center justify-between px-3 py-2 text-body">
                      <span className="text-ink">{row.name}</span>
                      <span className="text-caption text-ink-faint" dir="ltr">
                        {row.email}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  {t('setup.back')}
                </Button>
                <Button variant="primary" isLoading={busy} onClick={() => void finish(false)}>
                  {t('setup.finish')}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
