export interface OfflineQueuedAction {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  label: string;
  queuedAt: string;
}

const CACHE_KEY = 'studyglobe_cloud_cache_v1';
const QUEUE_KEY = 'studyglobe_offline_queue_v1';

export function saveOfflineCache(snapshot: unknown): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), snapshot }));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadOfflineCache<T>(): { savedAt: string; snapshot: T } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { savedAt: string; snapshot: T };
  } catch {
    return null;
  }
}

export function getOfflineQueue(): OfflineQueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueuedAction[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(action: Omit<OfflineQueuedAction, 'id' | 'queuedAt'>): OfflineQueuedAction[] {
  const queue = getOfflineQueue();
  const next: OfflineQueuedAction[] = [
    ...queue,
    {
      ...action,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      queuedAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next;
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
