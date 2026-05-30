import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createMarket } from "@/lib/contract";
import { toast } from "sonner";

export function CreateMarketDialog() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [url, setUrl] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => createMarket(question, url, outcomes),
    onSuccess: () => {
      toast.success("Market created on-chain");
      qc.invalidateQueries({ queryKey: ["markets"] });
      setOpen(false);
      setQuestion(""); setUrl(""); setOutcomes("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create market"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-neon text-neon-foreground hover:bg-neon/90 font-mono uppercase tracking-wider glow">
          + New Market
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Create market</DialogTitle>
          <DialogDescription>
            Validators will fetch your resolution URL and reach AI consensus on the outcome.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Will Manchester City win the Premier League 2025-26?" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Resolution URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.bbc.com/sport/football/premier-league/table" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Outcomes (comma-separated)</Label>
            <Textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} placeholder="Manchester City, Arsenal, Liverpool, Other" rows={2} />
          </div>
          <Button
            disabled={!question || !url || !outcomes || mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full bg-neon text-neon-foreground hover:bg-neon/90 font-mono uppercase tracking-wider"
          >
            {mut.isPending ? "Submitting…" : "Deploy market"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}