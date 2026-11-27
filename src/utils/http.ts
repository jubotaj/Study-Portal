export async function safeReadJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}.`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status >= 502 && res.status <= 504) {
      throw new Error('Server is temporarily restarting or unreachable (502/504). Please retry in a moment.');
    }
    if (text.trim().startsWith('<')) {
      throw new Error(
        `API endpoint returned HTML instead of JSON (HTTP ${res.status}). Make sure you are on the live Development App URL (full-stack server, not a static preview/Shared URL) and refresh the page.`,
      );
    }
    throw new Error(text.slice(0, 180));
  }
}
