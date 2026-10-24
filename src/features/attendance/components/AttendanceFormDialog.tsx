import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { userFacingMessage } from '@/lib/api/errors';
import type { ApiError } from '@/lib/api/errors';
import { useEmployeeList } from '@/features/employees/api/queries';
import { useCreateAttendance, useUpdateAttendance } from '../api/queries';
import type { AttendanceInput, AttendanceStatus } from '../api/resource';
import type { AttendanceWire } from '../api/schema';

/**
 * Add/Edit modal for one attendance record, built on `Dialog` + react-hook-form
 * + zod — same library combination as `EmployeeFormDialog`.
 *
 * Key differences vs. Employees:
 *  - Employee picker: native `<select>` fed by `useEmployeeList({ page:1, perPage:100 })`.
 *  - 'late' is a first-class status (the seeder writes it, the backend
 *    accepts it); a 'present' record may also carry `late_minutes > 0`.
 *  - `check_in`/`check_out` stored as `YYYY-MM-DD HH:mm:ss` on the wire.
 */

const REQUIRED = 'common.requiredField';

const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'present', 'absent', 'leave', 'holiday', 'weekend', 'half_day', 'late',
];

// Default work_schedule_id = 1 (only one schedule in mock, real API requires it)
const DEFAULT_WORK_SCHEDULE_ID = 1;

const attendanceFormSchema = z.object({
  employee_id: z.string().min(1, REQUIRED),
  date: z.string().min(1, REQUIRED),
  work_schedule_id: z.string().min(1, REQUIRED),
  check_in: z.string(),
  check_out: z.string(),
  status: z.string().min(1, REQUIRED),
  late_minutes: z.string(),
  notes: z.string(),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

/** Convert a `YYYY-MM-DD HH:mm:ss` wire value to an `<input type="datetime-local">` value. */
function wireToDatetimeLocal(wire: string | undefined): string {
  if (!wire) return '';
  // datetime-local needs `YYYY-MM-DDTHH:mm`
  return wire.slice(0, 16).replace(' ', 'T');
}

/** Convert an `<input type="datetime-local">` value back to the wire format. */
function datetimeLocalToWire(local: string): string | null {
  if (!local) return null;
  return local.replace('T', ' ') + ':00';
}

function buildDefaultValues(record: AttendanceWire | undefined): AttendanceFormValues {
  if (!record) {
    return {
      employee_id: '',
      date: new Date().toISOString().slice(0, 10),
      work_schedule_id: String(DEFAULT_WORK_SCHEDULE_ID),
      check_in: '',
      check_out: '',
      status: 'present',
      late_minutes: '',
      notes: '',
    };
  }

  return {
    employee_id: String(record.employee_id),
    date: record.date.slice(0, 10),
    work_schedule_id: String(record.work_schedule_id),
    check_in: wireToDatetimeLocal(record.check_in),
    check_out: wireToDatetimeLocal(record.check_out),
    status: record.status,
    late_minutes: record.late_minutes !== undefined ? String(record.late_minutes) : '',
    notes: record.notes ?? '',
  };
}

function toAttendanceInput(values: AttendanceFormValues): AttendanceInput {
  return {
    employee_id: Number(values.employee_id),
    date: values.date,
    work_schedule_id: Number(values.work_schedule_id),
    check_in: datetimeLocalToWire(values.check_in),
    check_out: datetimeLocalToWire(values.check_out),
    status: values.status as AttendanceStatus,
    late_minutes: values.late_minutes ? Number(values.late_minutes) : null,
    notes: values.notes.trim() || null,
  };
}

/** Pulls Laravel's `{errors: {field: [message]}}` 422 body into RHF field errors. */
function fieldErrorsFrom(error: ApiError | undefined): Record<string, string> {
  if (!error || error.status !== 422) return {};
  const body = error.body as { errors?: Record<string, string[]> } | undefined;
  if (!body?.errors) return {};
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(body.errors)) {
    if (messages[0]) result[field] = messages[0];
  }
  return result;
}

function translate(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined;
}

export interface AttendanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit (or pass `undefined`) to open in "Add Attendance" mode. */
  record?: AttendanceWire | undefined;
}

export function AttendanceFormDialog({ open, onOpenChange, record }: AttendanceFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = record !== undefined;

  const createMutation = useCreateAttendance();
  const updateMutation = useUpdateAttendance();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // Load employees for the picker (stable cross-feature hook)
  const { state: employeeState } = useEmployeeList({ page: 1, perPage: 100 });
  const employees = employeeState.data?.data ?? [];

  const resolver = useMemo(() => zodResolver(attendanceFormSchema), []);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AttendanceFormValues>({
    resolver,
    defaultValues: buildDefaultValues(record),
  });

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (open) reset(buildDefaultValues(record));
  }, [open, record, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      createMutation.reset();
      updateMutation.reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: AttendanceFormValues) {
    const input = toAttendanceInput(values);
    const result = isEdit
      ? await updateMutation.mutate({ id: record.id, ...input })
      : await createMutation.mutate(input);

    if (result) {
      handleOpenChange(false);
      return;
    }

    const fieldErrors = fieldErrorsFrom(isEdit ? updateMutation.error : createMutation.error);
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof AttendanceFormValues, { type: 'server', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={isEdit ? t('attendance.editRecord') : t('attendance.addRecord')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={isPending}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="attendance-form" variant="primary" isLoading={isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="attendance-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="rounded-[3px] border border-coral/30 bg-coral/5 px-3 py-2 text-caption text-coral">
              {userFacingMessage(mutationError)}
            </p>
          ) : null}

          {/* Employee picker */}
          <Field label={t('attendance.form.employee')} htmlFor="employee_id" required error={translate(t, errors.employee_id?.message)}>
            <Select id="employee_id" invalid={!!errors.employee_id} {...register('employee_id')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} — {emp.employee_number}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('attendance.form.date')} htmlFor="date" required error={translate(t, errors.date?.message)}>
              <Input id="date" type="date" invalid={!!errors.date} {...register('date')} />
            </Field>
            <Field label={t('attendance.form.status')} htmlFor="status" required error={translate(t, errors.status?.message)}>
              <Select id="status" invalid={!!errors.status} {...register('status')}>
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`attendance.status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('attendance.form.checkIn')} htmlFor="check_in" error={translate(t, errors.check_in?.message)}>
              <Input id="check_in" type="datetime-local" invalid={!!errors.check_in} {...register('check_in')} />
            </Field>
            <Field label={t('attendance.form.checkOut')} htmlFor="check_out" error={translate(t, errors.check_out?.message)}>
              <Input id="check_out" type="datetime-local" invalid={!!errors.check_out} {...register('check_out')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('attendance.form.lateMinutes')} htmlFor="late_minutes" error={translate(t, errors.late_minutes?.message)}>
              <Input id="late_minutes" type="number" min="0" invalid={!!errors.late_minutes} {...register('late_minutes')} />
            </Field>
            <Field label={t('attendance.form.workScheduleId')} htmlFor="work_schedule_id" required error={translate(t, errors.work_schedule_id?.message)}>
              <Input id="work_schedule_id" type="number" min="1" invalid={!!errors.work_schedule_id} {...register('work_schedule_id')} />
            </Field>
          </div>

          <Field label={t('attendance.form.notes')} htmlFor="notes" error={translate(t, errors.notes?.message)}>
            <Input id="notes" invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
