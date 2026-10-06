import { pravatar } from '@/features/dashboard/model';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  initials: string;
  photo?: string;
  department: string;
  checkIn: string;
  checkOut: string;
  status: AttendanceStatus;
  regularHours: number;
  lateMinutes: number;
}

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: 'a1',
    employeeName: 'Ahmed Sami',
    initials: 'AS',
    photo: pravatar(53),
    department: 'IT',
    checkIn: '08:54',
    checkOut: '17:12',
    status: 'present',
    regularHours: 8.3,
    lateMinutes: 0,
  },
  {
    id: 'a2',
    employeeName: 'Mona Khaled',
    initials: 'MK',
    photo: pravatar(44),
    department: 'HR',
    checkIn: '09:22',
    checkOut: '17:08',
    status: 'late',
    regularHours: 7.75,
    lateMinutes: 22,
  },
  {
    id: 'a3',
    employeeName: 'Karim Fouad',
    initials: 'KF',
    photo: pravatar(26),
    department: 'Finance',
    checkIn: '09:01',
    checkOut: '17:05',
    status: 'present',
    regularHours: 8.05,
    lateMinutes: 0,
  },
  {
    id: 'a4',
    employeeName: 'Salma Adel',
    initials: 'SA',
    photo: pravatar(9),
    department: 'Sales',
    checkIn: '—',
    checkOut: '—',
    status: 'leave',
    regularHours: 0,
    lateMinutes: 0,
  },
  {
    id: 'a5',
    employeeName: 'Omar Hassan',
    initials: 'OH',
    photo: pravatar(33),
    department: 'Operations',
    checkIn: '08:59',
    checkOut: '17:18',
    status: 'present',
    regularHours: 8.32,
    lateMinutes: 0,
  },
  {
    id: 'a6',
    employeeName: 'Nadia Fahmy',
    initials: 'NF',
    photo: pravatar(21),
    department: 'Legal',
    checkIn: '—',
    checkOut: '—',
    status: 'absent',
    regularHours: 0,
    lateMinutes: 0,
  },
  {
    id: 'a7',
    employeeName: 'Tamer Zakaria',
    initials: 'TZ',
    photo: pravatar(13),
    department: 'Admin',
    checkIn: '09:47',
    checkOut: '17:03',
    status: 'late',
    regularHours: 7.27,
    lateMinutes: 47,
  },
  {
    id: 'a8',
    employeeName: 'Layla Mostafa',
    initials: 'LM',
    photo: pravatar(47),
    department: 'Marketing',
    checkIn: '08:48',
    checkOut: '17:00',
    status: 'present',
    regularHours: 8.2,
    lateMinutes: 0,
  },
];

export const attendanceStats = {
  present: 1198,
  absent: 24,
  late: 38,
  onLeave: 31,
};
