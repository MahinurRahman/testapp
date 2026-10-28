const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type Note = {
  id: string;
  title: string;
  body: string;
  is_task: boolean;
  done: boolean;
  created_at: string;
  updated_at: string;
};

let offline = false;
export function setApiOffline(v: boolean) {
  offline = v;
}

export class OfflineError extends Error {
  constructor() {
    super("No connection");
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (offline) throw new OfflineError();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new OfflineError();
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const api = {
  list: () => req<Note[]>("/notes"),
  get: (id: string) => req<Note>(`/notes/${id}`),
  create: (data: { title: string; body: string; is_task: boolean }) =>
    req<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Note, "title" | "body" | "is_task" | "done">>) =>
    req<Note>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => req<{ ok: boolean }>(`/notes/${id}`, { method: "DELETE" }),
  reset: () => req<Note[]>("/notes/reset", { method: "POST" }),
};
