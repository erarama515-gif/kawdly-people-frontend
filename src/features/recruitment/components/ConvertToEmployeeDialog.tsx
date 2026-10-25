import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import {
  useBranchList,
  useDepartmentList,
  useJobPositionList,
} from '@/features/organization/api/queries';
import { useConvertToEmployee } from '../api/pipelineQueries';
import type { CandidateWire, ConvertToEmployeeInput } from '../api/pipelineQueries';

export interface ConvertDialogProps {
  candidate: CandidateWire | undefined;
  onClose: () => void;
}

export function ConvertToEmployeeDialog({ candidate, onClose }: ConvertDialogProps) {
  const { t } = useTranslation();
  const convertMutation = useConvertToEmployee();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    branch_id: '',
    department_id: '',
    job_position_id: '',
    joining_date: today,
    employment_type: 'full_time' as ConvertToEmployeeInput['employment_type'],
    work_location: 'office' as ConvertToEmployeeInput['work_location'],
  });

  const { state: branchState } = useBranchList({ page: 1, perPage: 200 });
  const branches = branchState.data?.data ?? [];
  const { state: departmentState } = useDepartmentList({ page: 1, perPage: 200 });
  const departments = departmentState.data?.data ?? [];
  const { state: positionState } = useJobPositionList({
    page: 1,
    perPage: 200,
    departmentId: form.department_id ? Number(form.department_id) : undefined,
  });
  const positions = positionState.data?.data ?? [];

  if (!candidate) return null;

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDepartmentChange(value: string) {
    setForm((prev) => ({ ...prev, department_id: value, job_position_id: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    const result = await convertMutation.mutate({
      candidateId: candidate.id,
      branch_id: Number(form.branch_id),
      department_id: Number(form.department_id),
      job_position_id: Number(form.job_position_id),
      joining_date: form.joining_date,
      employment_type: form.employment_type,
      work_location: form.work_location,
    });
    if (result !== undefined || convertMutation.error === undefined) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <h2 className="mb-4 text-body-sm font-semibold text-ink">
          {t('recruitment.convertToEmployee.title', {
            name: `${candidate.first_name} ${candidate.last_name}`,
            defaultValue: `Convert ${candidate.first_name} ${candidate.last_name} to Employee`,
          })}
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.branch')}
            <Select
              required
              value={form.branch_id}
              onChange={(e) => handleChange('branch_id', e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.department')}
            <Select
              required
              value={form.department_id}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('employees.form.jobPosition')}
            <Select
              required
              value={form.job_position_id}
              onChange={(e) => handleChange('job_position_id', e.target.value)}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>{position.title}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.joiningDate', { defaultValue: 'Joining Date' })}
            <input
              required
              type="date"
              value={form.joining_date}
              onChange={(e) => handleChange('joining_date', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.employmentType', { defaultValue: 'Employment Type' })}
            <select
              value={form.employment_type}
              onChange={(e) => handleChange('employment_type', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('recruitment.convertToEmployee.workLocation', { defaultValue: 'Work Location' })}
            <select
              value={form.work_location}
              onChange={(e) => handleChange('work_location', e.target.value)}
              className="rounded border border-hairline px-2 py-1 text-body-sm text-ink focus:outline-none focus:ring-1 focus:ring-navy/40"
            >
              <option value="office">Office</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>

          {convertMutation.error ? (
            <p className="text-body-sm text-coral">
              {userFacingMessage(convertMutation.error) ||
                t('recruitment.convertToEmployee.failed', { defaultValue: 'Conversion failed. Please try again.' })}
            </p>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={convertMutation.isPending}>
              {convertMutation.isPending
                ? t('common.loading')
                : t('recruitment.convertToEmployee.confirm', { defaultValue: 'Convert to Employee' })}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
