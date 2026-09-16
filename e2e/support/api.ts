import type { Page } from "@playwright/test";

/**
 * A GET that survives the dev server dropping a connection.
 *
 * Playwright runs the app under `next dev` (Turbopack) with several workers
 * at once, and it occasionally resets a keep-alive connection while
 * recompiling. A raw `page.request.get` then throws `ECONNRESET` and fails a
 * test that had nothing wrong with it.
 *
 * Returning `null` on a transport error rather than throwing is what lets
 * `expect.poll` do its job: **poll retries a mismatched value, not a thrown
 * exception**, so the retry has to be expressed as a value.
 */
export async function getJsonOrNull(
  page: Page,
  url: string,
): Promise<unknown | null> {
  try {
    const response = await page.request.get(url);
    if (!response.ok()) return null;
    return await response.json();
  } catch {
    return null;
  }
}
