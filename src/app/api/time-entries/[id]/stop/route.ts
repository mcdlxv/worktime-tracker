import { api } from "@/server/http/container";

export async function POST(request: Request, ctx: RouteContext<"/api/time-entries/[id]/stop">) {
  const { id } = await ctx.params;
  return api.stopEntry(request, id);
}
