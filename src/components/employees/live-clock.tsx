import { useNow } from "@/components/use-now";
import { formatClock } from "@/lib/format";

export function LiveClock({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return (
    <span className="font-mono text-2xl font-medium tabular-nums text-lamp">
      {formatClock(now - startedAt)}
    </span>
  );
}
