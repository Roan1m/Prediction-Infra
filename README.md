# GenLayer Prediction Market

An AI-resolved **prediction market** built as a GenLayer **Intelligent Contract** (Python).

Anyone can open a market with a question, a public **resolution URL**, and a list of
possible outcomes. Players predict an outcome. When the event has happened, anyone can
call `resolve` — GenLayer validators then fetch the URL from the **live web**, ask an
**LLM** which outcome the evidence supports, and reach **consensus** on the result using
the Equivalence Principle. Correct predictors earn points.

No oracles. No centralized backend. The judgment happens on-chain.

## How it works

```
create_market(question, resolution_url, outcomes[], deadline)  ->  market_id
predict(market_id, outcome)        # one prediction per player per market
resolve(market_id)                 # fetch web + LLM + validator consensus -> winner + scoring
```

Resolution uses the recommended **leader / validator** pattern
(`gl.vm.run_nondet_unsafe`). The leader fetches the page and asks the LLM for a
structured JSON decision `{ "analysis": "...", "outcome": "..." }`. Validators do the
same independently but only have to agree on the **`outcome`** field — the free-form
`analysis` text is allowed to differ. This is the "partial field matching" pattern from
the GenLayer docs and is exactly what prediction-market resolution needs.

## Project layout

```
contracts/
  prediction_market.py        # the Intelligent Contract
tests/
  test_prediction_market.py   # fast in-memory (direct mode) tests
deploy/
  deploy_prediction_market.ts # genlayer-js deploy script
gltest.config.yaml            # network configuration
requirements.txt
```

## Quick start

### Option A — GenLayer Studio (zero setup)

1. Open [studio.genlayer.com](https://studio.genlayer.com).
2. Create a new contract and paste the contents of `contracts/prediction_market.py`.
3. Deploy (the constructor takes no arguments).
4. Use the **Write Methods** panel:
   - `create_market` — e.g. question `"Who wins Brazil vs Jamaica on 2025-06-05?"`,
     `resolution_url` a real results page (e.g. a BBC Sport scores page),
     `outcomes` `["Brazil", "Jamaica", "Draw"]`.
   - `predict` — pick a market id and an outcome (switch the active account to simulate
     different players).
   - `resolve` — once the event is over; validators fetch the page and decide.
5. Use the **Read Methods** panel: `get_market`, `get_predictions`, `get_points`.

### Option B — Local tests (fast, no Docker)

```bash
pip install -r requirements.txt
pytest tests/ -v
```

Direct mode runs the contract in-memory and mocks web + LLM calls, so it is instant and
needs no network. Optionally lint first:

```bash
genvm-lint check contracts/prediction_market.py
```

### Option C — CLI deploy to a network

```bash
npm install -g genlayer
genlayer init && genlayer up          # local Studio (Docker)
genlayer deploy                       # runs deploy/deploy_prediction_market.ts
# or deploy directly:
genlayer deploy --contract contracts/prediction_market.py
```

For testnet, set the network and fund your account from the
[faucet](https://testnet-faucet.genlayer.foundation):

```bash
genlayer network testnet-bradbury
genlayer deploy --contract contracts/prediction_market.py
```

## Notes

- **GenVM version pin** — the first line of the contract pins the runtime
  (`# { "Depends": "py-genlayer:1jb45aa8..." }`). If your environment expects a different
  runner (e.g. `py-genlayer:test`), update that comment to match.
- **Web evidence must be public and stable.** Validators each fetch the page
  independently, so use a results page whose verdict is unambiguous. The contract only
  finalizes when the LLM returns a concrete outcome; otherwise it stays open
  (`UNRESOLVED`) and can be resolved again later.
- **Studio limitation:** native token (GEN) transfers to/from contracts are not supported
  in Studio, which is why this contract is **points-based**.

## Extension idea: real betting

To turn points into stakes:
- make `predict` `@gl.public.write.payable` and record `gl.message.value` per prediction;
- track the pool per outcome;
- in `resolve`, pay winners pro-rata via `emit_transfer(...)` (works on testnet, not in
  Studio). See the **Value Transfers** page in the GenLayer docs.
