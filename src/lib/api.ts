"use client";
import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";
import { readUserId, useSession } from "./session";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch wrapper that identifies the acting user via x-user-id. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-user-id", readUserId());
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

/** SWR hook keyed by path + acting user, so switching users refetches everything. */
export function useApi<T = unknown>(path: string | null, config?: SWRConfiguration & { poll?: number }) {
  const { userId } = useSession();
  const { poll, ...rest } = config ?? {};
  return useSWR<T>(path ? [path, userId] : null, ([p]: [string, string]) => api<T>(p), { refreshInterval: poll, revalidateOnFocus: true, ...rest });
}

/** Revalidate every cached key whose path starts with the prefix. */
export function refresh(prefix: string) {
  return globalMutate((key) => Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(prefix));
}
