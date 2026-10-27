import { api } from "@/server/http/container";

export async function POST(_request: Request, ctx: RouteContext<"/api/employees/[id]/timer/stop">) {
  const { id } = await ctx.params;
  return api.stopTimer(id);
}
