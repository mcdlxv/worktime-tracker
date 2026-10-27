import { api } from "@/server/http/container";

export async function POST(request: Request, ctx: RouteContext<"/api/employees/[id]/timer/start">) {
  const { id } = await ctx.params;
  return api.startTimer(request, id);
}
