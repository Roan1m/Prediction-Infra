import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Market } from "@/lib/genlayer";
import { predict, resolveMarket } from "@/lib/contract";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Sparkles, CheckCircle2, Hourglass } from "lucide-react";

export function MarketCard({ market }: { market: Market }) {
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();

  const predictMut = useMutation({
    mutationFn: (outcome: string) => predict(market.id, outcome),
    onSuccess: () => {
      toast.success(`Prediction submitted: ${selected}`);
      qc.invalidateQueries({ queryKey: ["markets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Prediction failed"),
  });

  const resolveMut = useMutation({
    mutationFn: () => resolveMarket(market.id),
    onSuccess: () => {
      toast.success("Resolution dispatched — validators reaching consensus");
      qc.invalidateQueries({ queryKey: ["markets"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Resolve failed"),
  });

  return (
    <article className="group relative rounded-lg border border-border bg-surface p-5 hover:border-neon/40 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="font-mono text-xs text-muted-foreground">
          MARKET #{String(market.id).padStart(3, "0")}
        </div>
        {market.resolved ? (
          <Badge className="bg-neon/15 text-neon border-neon/30 font-mono">
            <CheckCircle2 className="size-3 mr-1" /> RESOLVED
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono border-accent/40 text-accent">
            <Hourglass className="size-3 mr-1" /> OPEN
          </Badge>
        )}
      </div>

      <h3 className="text-lg font-semibold leading-snug mb-3">{market.question}</h3>

      <a
        href={market.resolution_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-neon mb-4 break-all"
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate max-w-[300px]">{market.resolution_url}</span>
      </a>

      <div className="space-y-2 mb-4">
        {market.outcomes.map((o) => {
          const isWinner = market.resolved && market.winning_outcome === o;
          const isSelected = selected === o;
          return (
            <button
              key={o}
              disabled={market.resolved || predictMut.isPending}
              onClick={() => setSelected(o)}
              className={`w-full text-left px-4 py-2.5 rounded-md border font-mono text-sm transition-all ${
                isWinner
                  ? "border-neon bg-neon/10 text-neon glow"
                  : isSelected
                    ? "border-neon/60 bg-neon/5 text-foreground"
                    : "border-border bg-surface-2 hover:border-neon/30 text-foreground/90"
              } ${market.resolved ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="text-muted-foreground mr-2">›</span>
              {o}
              {isWinner && <span className="float-right text-xs">✓ WINNER</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="font-mono text-xs text-muted-foreground">
          {market.prediction_count} prediction{market.prediction_count === 1 ? "" : "s"}
        </div>
        {!market.resolved && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={resolveMut.isPending}
              onClick={() => resolveMut.mutate()}
              className="font-mono text-xs border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
            >
              <Sparkles className="size-3 mr-1" />
              {resolveMut.isPending ? "Resolving…" : "AI Resolve"}
            </Button>
            <Button
              size="sm"
              disabled={!selected || predictMut.isPending}
              onClick={() => selected && predictMut.mutate(selected)}
              className="bg-neon text-neon-foreground hover:bg-neon/90 font-mono text-xs"
            >
              {predictMut.isPending ? "Submitting…" : "Predict"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}