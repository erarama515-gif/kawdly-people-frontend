/*
 * i18n keys used in this file (add to en.json / ar.json):
 *   fileUpload.dragOrClick       — "Drag & drop a file here, or click to select"
 *   fileUpload.uploading         — "Uploading…"
 *   fileUpload.changeFile        — "Change file"
 *   fileUpload.uploadError       — "Upload failed. Please try again."
 *   fileUpload.fileTooLarge      — "File exceeds the {{maxSizeMB}} MB limit."
 *   fileUpload.invalidType       — "File type not allowed."
 */

import { useRef, useState, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { env } from '@/config/env';
import { getAuthorizationHeader } from '@/auth/token';

// ─── Public types ───────────────────────────────────────────────────────────

/** Shape returned by POST /api/v1/uploads and passed to `onUpload`. */
export interface UploadedFile {
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
}

export interface FileUploadProps {
  /** Called after a successful upload with the server-returned metadata. */
  onUpload: (file: UploadedFile) => void;
  /**
   * MIME-type accept string forwarded to the hidden <input>.
   * E.g. "image/*,application/pdf"
   * Defaults to all allowed backend types.
   */
  accept?: string;
  /** Client-side size cap in MB. Defaults to 10. Must be ≤ server limit. */
  maxSizeMB?: number;
  /** Shows the component in an error state. */
  invalid?: boolean;
  /** Disables all interaction. */
  disabled?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.csv';
const DEFAULT_MAX_MB = 10;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

interface UploadResponseEnvelope {
  data: UploadedFile;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Reusable drag-and-drop file upload widget.
 *
 * Renders three states:
 *   1. Empty — drag-target zone with icon + label.
 *   2. Uploading — same zone with a progress bar.
 *   3. Done — thumbnail (images) or file-icon + name, with a remove/replace button.
 *
 * On successful upload `onUpload` is called with the full server metadata so
 * the parent form can store `path`, `original_name`, `mime_type`, and `size`
 * without knowing anything about the upload API.
 */
export function FileUpload({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  invalid = false,
  disabled = false,
  className,
}: FileUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept, maxSizeMB],
  );

  // ── File-input change ────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void uploadFile(file);
      // Reset the input so the same file can be re-selected after a clear.
      if (inputRef.current) inputRef.current.value = '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept, maxSizeMB],
  );

  // ── Core upload logic ─────────────────────────────────────────────────────

  async function uploadFile(file: File): Promise<void> {
    setError(null);
    setUploaded(null);

    // Client-side guards (mirrors the server validation for instant feedback).
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(t('fileUpload.fileTooLarge', { maxSizeMB }));
      return;
    }

    setProgress(0);

    try {
      // Use XHR instead of fetch for upload progress events.
      const result = await uploadWithProgress(file, (pct) => setProgress(pct));
      setUploaded(result);
      onUpload(result);
    } catch {
      setError(t('fileUpload.uploadError'));
    } finally {
      setProgress(null);
    }
  }

  // ── XHR upload with progress ──────────────────────────────────────────────

  function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201 || xhr.status === 200) {
          try {
            const body = JSON.parse(xhr.responseText) as UploadResponseEnvelope;
            resolve(body.data);
          } catch {
            reject(new Error('Invalid response body'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      const baseUrl = (env.apiBaseUrl || '/api/v1').replace(/\/$/, '');
      xhr.open('POST', `${baseUrl}/uploads`);

      const auth = getAuthorizationHeader();
      if (auth) xhr.setRequestHeader('Authorization', auth);
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.send(formData);
    });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setUploaded(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isUploading = progress !== null;
  const isImage = uploaded ? IMAGE_MIMES.has(uploaded.mime_type) : false;

  // Uploaded state
  if (uploaded) {
    return (
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-[3px] border border-hairline bg-surface p-3',
          invalid && 'border-coral',
          className,
        )}
      >
        {isImage ? (
          <img
            src={uploaded.url}
            alt={uploaded.original_name}
            className="h-12 w-12 rounded object-cover shrink-0"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-hover">
            <FileText className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{uploaded.original_name}</p>
          <p className="text-caption text-ink-faint">{formatBytes(uploaded.size)}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-hover hover:text-coral"
            aria-label={t('fileUpload.changeFile')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    );
  }

  // Drop-zone state (idle or uploading)
  return (
    <div
      role="button"
      tabIndex={disabled || isUploading ? -1 : 0}
      onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && !isUploading && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[3px] border-2 border-dashed px-4 py-6 text-center transition-colors',
        isDragging
          ? 'border-navy bg-navy/5'
          : invalid
          ? 'border-coral bg-coral/5'
          : 'border-hairline bg-surface hover:border-navy/40 hover:bg-surface-hover',
        (disabled || isUploading) && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={handleChange}
        tabIndex={-1}
      />

      <UploadCloud
        className={cn('h-8 w-8', isDragging ? 'text-navy' : 'text-ink-muted')}
        strokeWidth={1.5}
      />

      {isUploading ? (
        <div className="w-full max-w-[200px]">
          <p className="mb-1.5 text-caption text-ink-muted">{t('fileUpload.uploading')}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-navy transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-caption text-ink-muted">{t('fileUpload.dragOrClick')}</p>
      )}

      {error ? (
        <p role="alert" className="text-caption text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
