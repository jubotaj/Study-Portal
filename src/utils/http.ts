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
      throw new Error(`Server returned an unexpected HTML response (HTTP ${res.status}). Please refresh or retry.`);
    }
    throw new Error(text.slice(0, 180));
  }
}
