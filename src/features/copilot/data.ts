/**
 * Typed mock data for the AI Copilot page.
 * Suggested queries and an example response are kept here so the component
 * stays stateless and this file becomes the single seam for a real API.
 */

// ─── Suggested Queries ────────────────────────────────────────────────────────

export interface SuggestedQuery {
  id: string;
  label: string;
  /** Short sub-label giving the user a hint of what they'll see. */
  hint: string;
}

export const suggestedQueries: SuggestedQuery[] = [
  {
    id: 'sq1',
    label: 'Employees with leave > 15 days',
    hint: '34 employees matched',
  },
  {
    id: 'sq2',
    label: 'Contracts expiring next month',
    hint: '8 contracts due',
  },
  {
    id: 'sq3',
    label: 'Sales department performance',
    hint: 'Attendance, overtime, KPIs',
  },
  {
    id: 'sq4',
    label: 'Overtime cost analysis',
    hint: 'SAR 620K this period',
  },
  {
    id: 'sq5',
    label: 'Turnover trend this year',
    hint: '8.4% — up 0.6 pts',
  },
  {
    id: 'sq6',
    label: 'Open positions by department',
    hint: '73 open roles',
  },
];

// ─── Example Response ─────────────────────────────────────────────────────────

export interface CopilotResponse {
  query: string;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
}

export const exampleResponse: CopilotResponse = {
  query: 'Overtime cost analysis',
  answer:
    'This period\'s overtime spend is SAR 620,000 — up 12% month-over-month. The Operations department accounts for the largest share at SAR 218,000 (35%), followed by Sales at SAR 140,000 (23%). Three employees each logged over 40 overtime hours: Omar Hassan (52h), Tamer Zakaria (46h), and Karim Fouad (41h). At the current trajectory, the annual overtime budget of SAR 6.5M will be reached by November.',
  highlights: [
    { label: 'Total OT Cost', value: 'SAR 620K' },
    { label: 'vs. Last Month', value: '+12%' },
    { label: 'Top Dept', value: 'Operations' },
    { label: 'Employees > 40h', value: '3' },
  ],
};
