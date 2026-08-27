/**
 * Handing the browser a file to save.
 *
 * Four lines of obvious code get this wrong, and the failure is silent, so it
 * lives here once with the reasons attached:
 *
 * 1. **The anchor has to be in the document.** Firefox ignores a programmatic
 *    click on a detached element, so the download simply never starts.
 * 2. **The object URL must not be revoked synchronously.** `click()` only
 *    *queues* the download; revoking on the next line can pull the blob out
 *    from under it. Chrome happens to tolerate this and WebKit frequently does
 *    not, which is exactly the kind of bug that only appears on somebody's
 *    phone. A timeout gives the fetch time to start, and the URL is still
 *    released rather than leaked for the life of the page.
 * 3. **`rel="noopener"`**, because the anchor is real and a target could be
 *    forced onto it by an extension.
 * 4. **Cleaning up the anchor**, so a page that exports twenty times does not
 *    accumulate twenty dead nodes.
 *
 * This is the whole story for the export and the share-card fallback. Neither
 * of them is a nicety: local storage is the only place training data lives, so
 * an export that quietly does nothing is data loss waiting to happen.
 */

/** Long enough for the browser to have started fetching the blob. */
const REVOKE_AFTER_MS = 60_000

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
  }
}
