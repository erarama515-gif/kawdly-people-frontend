import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Users, User, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { userFacingMessage } from '@/lib/api/errors';
import { useOrgChart } from '../api/orgChartQueries';
import type { OrgChartDepartmentNode, OrgChartRoot } from '../api/orgChartQueries';

/**
 * Interactive department hierarchy tree.
 *
 * - Pure React + CSS — no D3/reactflow dependency.
 * - Nodes are cards connected by CSS border-based lines.
 * - Expand / collapse sub-departments by clicking a node.
 * - Horizontally scrollable container for wide trees.
 * - Zoom via CSS `transform: scale()` with +/− buttons.
 * - Design tokens: bg-surface, border-hairline, text-ink, navy, coral.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: OrgChartDepartmentNode;
  isRoot?: boolean;
  defaultExpanded?: boolean;
}

// ─── Single node card ─────────────────────────────────────────────────────────

function OrgNode({ node, defaultExpanded = true }: NodeCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={cn(
          'relative flex w-[200px] flex-col gap-1.5 rounded-xl border border-hairline bg-surface px-4 py-3 shadow-sm',
          'transition-shadow hover:shadow-md',
          hasChildren && 'cursor-pointer select-none',
        )}
        onClick={hasChildren ? () => setExpanded((v) => !v) : undefined}
        role={hasChildren ? 'button' : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={
          hasChildren
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }
            : undefined
        }
      >
        {/* Dept name + expand toggle */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-[13px] font-semibold leading-tight text-ink">{node.name}</p>
          {hasChildren && (
            <span className="mt-0.5 shrink-0 text-ink-muted">
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
            </span>
          )}
        </div>

        {/* Head */}
        {node.head ? (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <User className="h-3 w-3 shrink-0 text-navy" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{node.head.name}</p>
              {node.head.title && (
                <p className="truncate text-ink-faint">{node.head.title}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-ink-faint italic">{t('organization.department.vacant')}</p>
        )}

        {/* Employee count */}
        <div className="flex items-center gap-1 text-[11px] text-ink-muted">
          <Users className="h-3 w-3 shrink-0 text-coral" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {node.employee_count} {t('organization.employees')}
          </span>
        </div>

        {/* Left border accent */}
        <div className="absolute start-0 inset-y-2 w-[3px] rounded-full bg-navy/30" aria-hidden="true" />
      </div>

      {/* Children subtree */}
      {hasChildren && expanded && (
        <div className="relative mt-0 flex flex-col items-center">
          {/* Vertical line from parent down to horizontal bar */}
          <div
            className="h-6 w-px bg-[#c5d8e8]"
            aria-hidden="true"
          />

          {/* Horizontal connector row — only when multiple children */}
          <div className="relative flex items-start gap-6">
            {/* Horizontal bar spanning all children */}
            {node.children.length > 1 && (
              <div
                className="pointer-events-none absolute top-0 start-[calc(50%-1px)] h-px bg-[#c5d8e8]"
                style={{ width: `calc(100% - 200px)`, left: '100px', right: '100px' }}
                aria-hidden="true"
              />
            )}

            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Short vertical drop before each child */}
                <div className="h-6 w-px bg-[#c5d8e8]" aria-hidden="true" />
                <OrgNode node={child} defaultExpanded={false} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root company box ─────────────────────────────────────────────────────────

function CompanyRootNode({ root }: { root: OrgChartRoot }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex w-[220px] flex-col items-center justify-center rounded-2xl px-5 py-4',
          'bg-navy text-surface shadow-md',
        )}
      >
        <p className="text-center text-[14px] font-bold leading-tight">{root.name}</p>
      </div>

      {root.children.length > 0 && (
        <div className="h-8 w-px bg-[#c5d8e8]" aria-hidden="true" />
      )}
    </div>
  );
}

// ─── Zoom controls ────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.4;

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2 py-1 shadow-sm">
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 text-lg font-bold"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        aria-label="Zoom out"
      >
        −
      </Button>
      <button
        className="min-w-[48px] text-center text-[12px] font-mono text-ink-muted hover:text-ink"
        onClick={onReset}
        aria-label="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        variant="ghost"
        className="h-7 w-7 px-0 text-lg font-bold"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
      >
        +
      </Button>
    </div>
  );
}

// ─── Main OrgChart component ──────────────────────────────────────────────────

export function OrgChart() {
  const { t } = useTranslation();
  const { state, refetch } = useOrgChart();
  const [zoom, setZoom] = useState(1.0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
  const resetZoom = useCallback(() => setZoom(1.0), []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state.status === 'pending') {
    return (
      <Card className="flex items-center justify-center px-8 py-24 text-body-sm text-ink-muted">
        <span className="animate-pulse">{t('common.loading', 'Loading…')}</span>
      </Card>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state.error) {
    return (
      <Card className="flex items-center justify-between gap-3 px-5 py-4 text-body-sm text-coral">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{userFacingMessage(state.error) || t('organization.loadFailed')}</span>
        </div>
        <Button variant="secondary" onClick={() => void refetch()}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const root = state.data?.data;

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!root || root.children.length === 0) {
    return (
      <Card className="px-8 py-24 text-center text-body-sm text-ink-muted">
        {t('organization.emptySearch')}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <ZoomControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
        />
      </div>

      {/* Tree canvas — horizontally scrollable */}
      <div
        ref={scrollRef}
        className="overflow-auto rounded-xl border border-hairline bg-slate-50 p-8"
        style={{ minHeight: '400px' }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
            // Keep the outer div the right height after scaling so scroll works
            minWidth: 'max-content',
          }}
        >
          {/* Company root */}
          <CompanyRootNode root={root} />

          {/* Top-level departments */}
          {root.children.length > 0 && (
            <div className="relative flex items-start justify-center gap-6">
              {/* Horizontal connecting bar */}
              {root.children.length > 1 && (
                <div
                  className="pointer-events-none absolute top-0 h-px bg-[#c5d8e8]"
                  style={{
                    left: '100px',
                    right: '100px',
                  }}
                  aria-hidden="true"
                />
              )}

              {root.children.map((dept) => (
                <div key={dept.id} className="flex flex-col items-center">
                  <OrgNode node={dept} defaultExpanded={true} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
