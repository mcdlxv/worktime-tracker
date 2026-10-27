import { api } from "@/server/http/container";

export async function POST(request: Request, ctx: RouteContext<"/api/employees/[id]/timer/stop">) {
  const { id } = await ctx.params;
  return api.stopTimer(request, id);
}
