import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";
import { MarketCard } from "@/components/MarketCard";
import { fetchMarkets } from "@/lib/contract";
import { CONTRACT_ADDRESS } from "@/lib/genlayer";
import { Brain, Globe, Network } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oracle — AI-resolved prediction markets on GenLayer" },
      { name: "description", content: "Create prediction markets resolved by decentralized AI consensus. No oracles. No backends. Just validators reading the live web." },
      { property: "og:title", content: "Oracle — Prediction markets on GenLayer" },
      { property: "og:description", content: "Decentralized AI consensus resolves your bets — straight from the live web." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: markets = [], isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    refetchInterval: 15_000,
  });

  const open = markets.filter((m) => !m.resolved);
  const resolved = markets.filter((m) => m.resolved);

  return (
    <div className="min-h-screen">
      <Header />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-neon mb-6">
            ▌ Intelligent contract · live on GenLayer
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.05] max-w-4xl">
            Prediction markets, <span className="text-neon text-glow">resolved by AI consensus</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Pose a question, link a source, list outcomes. When the dust settles, GenLayer validators read the live web, ask the LLM, and reach consensus on the Equivalence Principle. No oracles. No backends.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <CreateMarketDialog />
            <a
              href={`https://studio.genlayer.com/contracts/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs px-4 py-2.5 rounded-md border border-border bg-surface hover:border-neon/40 hover:text-neon transition-colors"
            >
              {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-8)}
            </a>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
            {[
              { icon: Globe, title: "Live web", body: "gl.nondet.web.get pulls the source at resolve time." },
              { icon: Brain, title: "LLM judgment", body: "Validators ask the model which outcome the evidence supports." },
              { icon: Network, title: "Consensus", body: "Equivalence Principle agrees on the decision, not the prose." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-surface/60 p-4">
                <f.icon className="size-5 text-neon mb-3" />
                <div className="font-mono text-xs uppercase tracking-wider text-foreground/90">{f.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-12">
        <Section title="Open markets" count={open.length}>
          {isLoading ? (
            <Empty>Loading on-chain state…</Empty>
          ) : open.length === 0 ? (
            <Empty>
              No open markets yet. Create the first one.
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {open.map((m) => <MarketCard key={m.id} market={m} />)}
            </div>
          )}
        </Section>

        {resolved.length > 0 && (
          <Section title="Resolved" count={resolved.length}>
            <div className="grid md:grid-cols-2 gap-4">
              {resolved.map((m) => <MarketCard key={m.id} market={m} />)}
            </div>
          </Section>
        )}
      </main>

      <footer className="border-t border-border/60 mt-20">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <div>Built on GenLayer · Intelligent Contracts</div>
          <div>No oracles · No backends · Just consensus</div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-3xl font-semibold">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{count} total</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-12 text-center text-sm text-muted-foreground font-mono">
      {children}
    </div>
  );
}
