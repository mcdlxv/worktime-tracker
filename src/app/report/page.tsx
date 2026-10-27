import type { Metadata } from "next";
import { ReportBoard } from "@/components/report/report-board";

export const metadata: Metadata = { title: "Отчёт — Табель" };

export default function ReportPage() {
  return <ReportBoard />;
}
