import { useEffect, useState } from "react";
import { getOrCreateAccount } from "@/lib/genlayer";
import logoMark from "@/assets/logo-mark.png";

export function Header() {
  const [addr, setAddr] = useState<string>("");

  useEffect(() => {
    setAddr(getOrCreateAccount().address);
  }, []);

  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "…";

  return (
    <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-40 bg-background/70">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logoMark}
            alt="Oracle logo"
            className="size-9 rounded-md glow"
            width={36}
            height={36}
          />
          <div>
            <div className="text-sm font-mono tracking-widest text-neon">GENLAYER</div>
            <div className="text-xs text-muted-foreground -mt-0.5">AI-resolved prediction markets</div>
          </div>
        </div>
        <div className="font-mono text-xs px-3 py-2 rounded-md border border-border bg-surface">
          <span className="text-muted-foreground mr-2">wallet</span>
          <span className="text-neon">{short}</span>
        </div>
      </div>
    </header>
  );
}