import { api } from "@/server/http/container";

export function GET() {
  return api.listEmployees();
}

export function POST(request: Request) {
  return api.addEmployee(request);
}
