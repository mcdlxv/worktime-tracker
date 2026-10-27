import { demoReset } from "@/server/http/container";

// Vercel Cron calls this once a day (vercel.json).
export function GET(request: Request) {
  return demoReset(request);
}
