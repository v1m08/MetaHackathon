import { NextRequest, NextResponse } from "next/server";
import { getUser } from "./db";

export const DEFAULT_USER = "maya";

/** The acting user comes from the x-user-id header (set by the client from its per-tab session). */
export function currentUserId(req: NextRequest): string {
  const id = req.headers.get("x-user-id") || req.nextUrl.searchParams.get("as") || DEFAULT_USER;
  return getUser(id) ? id : DEFAULT_USER;
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: { userId: string; params: P; body: () => Promise<Record<string, unknown>> }) => unknown | Promise<unknown>;

/** Wraps a route handler: resolves params, acting user, JSON body; converts thrown errors to JSON. */
export function route<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      let cached: Record<string, unknown> | undefined;
      const body = async () => (cached ??= (await req.json().catch(() => ({}))) as Record<string, unknown>);
      const data = await fn(req, { userId: currentUserId(req), params, body });
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      const err = e as Error & { status?: number };
      console.error("[api]", req.method, req.nextUrl.pathname, err.message);
      return NextResponse.json({ error: err.message || "Server error" }, { status: err.status ?? 500 });
    }
  };
}
