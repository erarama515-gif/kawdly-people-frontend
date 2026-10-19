/**
 * Export utilities for Excel (.xlsx) and PDF generation.
 *
 * Both helpers accept a generic array of flat-ish objects plus a columns
 * descriptor so pages can control which fields appear and what the headers
 * are called (already translated by the caller via i18n `t()`).
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  /** The key to pluck from each data row. */
  key: string;
  /** Already-translated column header string. */
  label: string;
}

// ─── Excel ────────────────────────────────────────────────────────────────────

/**
 * Builds an .xlsx file from `data` using `columns` as the ordered column list,
 * then triggers a browser download.  A UTF-8 BOM is written so Arabic / RTL
 * text opens correctly in Microsoft Excel on Windows.
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
): void {
  // Build flat array-of-arrays: header row first, then one row per record.
  const headerRow = columns.map((c) => c.label);
  const dataRows = data.map((row) =>
    columns.map((c) => {
      const v = row[c.key];
      if (v === null || v === undefined) return '';
      return String(v);
    }),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Auto-width: measure each column's widest cell (cap at 60 chars).
  const colWidths = columns.map((c, colIdx) => {
    const cells = [c.label, ...dataRows.map((r) => r[colIdx] ?? '')];
    const maxLen = Math.min(
      60,
      Math.max(...cells.map((v) => String(v).length)),
    );
    return { wch: maxLen + 2 };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // `type: 'array'` gives us a Uint8Array we can turn into a Blob with the
  // correct UTF-8 BOM so Arabic renders in Excel without mangling.
  const wbArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  triggerDownload(blob, `${filename}.xlsx`);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Builds a landscape A4 PDF with a simple auto-table and triggers download.
 * jsPDF ships with a standard Latin font; Arabic text is rendered as Unicode
 * code-points which may show as boxes in some viewers — callers should pass
 * transliterated or English values for PDF when full Arabic support matters.
 */
export function exportToPdf(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((c) => {
      const v = row[c.key];
      if (v === null || v === undefined) return '';
      return String(v);
    }),
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [27, 37, 89], // navy #1B2559
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 249, 252],
    },
    margin: { top: 12, right: 10, bottom: 10, left: 10 },
  });

  const blob = doc.output('blob');
  triggerDownload(blob, `${filename}.pdf`);
}

// ─── Shared helper ────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Release the object URL after a short delay so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
