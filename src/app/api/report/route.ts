import { api } from "@/server/http/container";

export function GET(request: Request) {
  return api.getReport(request);
}
