import { pravatar } from '@/features/dashboard/model';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity';

export interface LeaveRequest {
  id: string;
  employeeName: string;
  initials: string;
  photo?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason: string;
}

export const leaveRequests: LeaveRequest[] = [
  {
    id: 'lr1',
    employeeName: 'Ahmed Sami',
    initials: 'AS',
    photo: pravatar(53),
    leaveType: 'annual',
    startDate: '2 Oct 2026',
    endDate: '6 Oct 2026',
    days: 5,
    status: 'pending',
    reason: 'Family vacation',
  },
  {
    id: 'lr2',
    employeeName: 'Mona Khaled',
    initials: 'MK',
    photo: pravatar(44),
    leaveType: 'sick',
    startDate: '30 Sep 2026',
    endDate: '1 Oct 2026',
    days: 2,
    status: 'approved',
    reason: 'Medical appointment',
  },
  {
    id: 'lr3',
    employeeName: 'Omar Hassan',
    initials: 'OH',
    photo: pravatar(33),
    leaveType: 'emergency',
    startDate: '30 Sep 2026',
    endDate: '30 Sep 2026',
    days: 1,
    status: 'approved',
    reason: 'Family emergency',
  },
  {
    id: 'lr4',
    employeeName: 'Layla Mostafa',
    initials: 'LM',
    photo: pravatar(47),
    leaveType: 'annual',
    startDate: '5 Oct 2026',
    endDate: '9 Oct 2026',
    days: 5,
    status: 'pending',
    reason: 'Personal travel',
  },
  {
    id: 'lr5',
    employeeName: 'Karim Fouad',
    initials: 'KF',
    photo: pravatar(26),
    leaveType: 'sick',
    startDate: '28 Sep 2026',
    endDate: '29 Sep 2026',
    days: 2,
    status: 'rejected',
    reason: 'Insufficient sick leave balance',
  },
  {
    id: 'lr6',
    employeeName: 'Nadia Fahmy',
    initials: 'NF',
    photo: pravatar(21),
    leaveType: 'maternity',
    startDate: '1 Oct 2026',
    endDate: '31 Dec 2026',
    days: 90,
    status: 'approved',
    reason: 'Maternity leave',
  },
];

export const leaveStats = {
  pendingRequests: 17,
  approvedToday: 8,
  onLeaveNow: 31,
  balanceUsedPct: 62,
};
