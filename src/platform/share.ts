/**
 * Getting a file off the device — the only way data ever leaves it.
 *
 * Two paths, one seam. `downloadBlob` is the browser fallback every export has always
 * used; `shareOrDownloadFile` first offers the OS share sheet when the platform exposes
 * one (the Web Share API, which the Capacitor WKWebView and mobile browsers implement for
 * files), and falls back to the same download when it does not. Nothing is uploaded, and
 * the caller is told which path actually ran rather than being left to assume.
 */

/** Triggers a browser download without touching the network. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

interface FileShareNavigator {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
}

export function canShareFiles(file: File): boolean {
  const nav = navigator as FileShareNavigator;
  return typeof nav.share === 'function' && nav.canShare?.({ files: [file] }) === true;
}

/**
 * Hands `file` to the OS share sheet, or downloads it when there is no sheet.
 *
 * A share the user backs out of returns `cancelled` — it is not an error and must not be
 * retried as a download, because that would write a file the user just declined to save.
 */
export async function shareOrDownloadFile(file: File, title?: string): Promise<ShareResult> {
  if (canShareFiles(file)) {
    try {
      await (navigator as FileShareNavigator).share?.({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Anything else (permission, unsupported payload) still deserves a saved file.
    }
  }
  downloadBlob(file.name, file);
  return 'downloaded';
}
