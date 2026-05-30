# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json
import typing
from dataclasses import dataclass


# PredictionMarket - an AI-resolved prediction market Intelligent Contract.
#
#   - Anyone creates a market: question, public resolution URL, comma-separated
#     outcomes (e.g. "Brazil, Jamaica, Draw").
#   - Players predict an outcome (one prediction per player per market).
#   - Anyone resolves a market once the event happened: GenLayer validators
#     fetch the URL from the live web, ask an LLM which outcome the evidence
#     supports, and agree via the Equivalence Principle (only the decision
#     field has to match, the analysis text may differ).
#   - Correct predictors earn 1 point.
#
# Storage uses only documented patterns: flat DynArray[Market] +
# DynArray[Prediction] + TreeMap[Address, u256]. A market id is its index in
# `markets`; outcomes are stored as a comma-separated string and each Prediction
# carries its market_id. Public method signatures use plain int / str (sized
# ints are storage-only).


@allow_storage
@dataclass
class Prediction:
    market_id: u256
    player: Address
    outcome: str
    scored: bool
    correct: bool


@allow_storage
@dataclass
class Market:
    creator: Address
    question: str
    resolution_url: str
    deadline: str  # informational ISO-8601 string (not enforced on-chain)
    outcomes_csv: str  # normalized comma-separated outcomes, e.g. "Brazil,Jamaica,Draw"
    resolved: bool
    winning_outcome: str
    analysis: str


class PredictionMarket(gl.Contract):
    markets: DynArray[Market]
    predictions: DynArray[Prediction]
    points: TreeMap[Address, u256]

    def __init__(self) -> None:
        pass

    # ------------------------------------------------------------------
    # helpers (plain python, run in deterministic context)
    # ------------------------------------------------------------------
    def _split(self, csv: str) -> list:
        return [o.strip() for o in csv.split(",") if o.strip() != ""]

    # ------------------------------------------------------------------
    # Write methods
    # ------------------------------------------------------------------
    @gl.public.write
    def create_market(
        self,
        question: str,
        resolution_url: str,
        outcomes: str,
        deadline: str,
    ) -> int:
        """Create a market and return its id (its index in `markets`).

        `outcomes` is a comma-separated string, e.g. "Brazil, Jamaica, Draw".
        """
        parsed = self._split(outcomes)
        if len(parsed) < 2:
            raise gl.vm.UserError("a market needs at least two outcomes (comma-separated)")

        self.markets.append(
            Market(
                creator=gl.message.sender_address,
                question=question,
                resolution_url=resolution_url,
                deadline=deadline,
                outcomes_csv=",".join(parsed),
                resolved=False,
                winning_outcome="",
                analysis="",
            )
        )
        return len(self.markets) - 1

    @gl.public.write
    def predict(self, market_id: int, outcome: str) -> None:
        """Register the caller's prediction for a market."""
        if market_id < 0 or market_id >= len(self.markets):
            raise gl.vm.UserError("market not found")

        market = self.markets[market_id]
        if market.resolved:
            raise gl.vm.UserError("market already resolved")

        if outcome not in self._split(market.outcomes_csv):
            raise gl.vm.UserError("invalid outcome for this market")

        sender = gl.message.sender_address
        for p in self.predictions:
            if p.market_id == market_id and p.player == sender:
                raise gl.vm.UserError("you already predicted on this market")

        self.predictions.append(
            Prediction(
                market_id=u256(market_id),
                player=sender,
                outcome=outcome,
                scored=False,
                correct=False,
            )
        )

    @gl.public.write
    def resolve(self, market_id: int) -> typing.Any:
        """
        Resolve a market using live web data + an LLM, with validator consensus.

        The leader fetches the URL and asks an LLM which outcome the evidence
        supports. Validators independently do the same and only need to agree on
        the `outcome` field (the analysis text is allowed to differ).
        """
        if market_id < 0 or market_id >= len(self.markets):
            raise gl.vm.UserError("market not found")

        market = self.markets[market_id]
        if market.resolved:
            raise gl.vm.UserError("market already resolved")

        # Copy what we need into plain memory BEFORE the nondet block:
        # storage is not accessible inside non-deterministic blocks.
        url = market.resolution_url
        question = market.question
        outcomes = self._split(market.outcomes_csv)

        def leader_fn() -> typing.Any:
            response = gl.nondet.web.get(url)
            page = response.body.decode("utf-8")[:8000]  # keep the prompt bounded

            prompt = f"""You are resolving a prediction market based ONLY on the evidence below.

Question: {question}
Possible outcomes: {json.dumps(outcomes)}

<web_page>
{page}
</web_page>
End of web page.

Decide which single outcome the evidence supports.
- The "outcome" MUST be exactly one of the possible outcomes listed above.
- If the event has not happened yet, or you cannot determine it from the
  evidence, set "outcome" to "UNRESOLVED".

Respond ONLY with JSON in this exact shape, nothing else:
{{
  "analysis": "<one or two sentences explaining your decision>",
  "outcome": "<one of the outcomes exactly, or UNRESOLVED>"
}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict):
                raise gl.vm.UserError("LLM did not return a JSON object")
            return result

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            mine = leader_fn()
            leader_outcome = str(leader_result.calldata.get("outcome", "")).strip()
            my_outcome = str(mine.get("outcome", "")).strip()
            return leader_outcome == my_outcome  # consensus only on the decision

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        outcome = str(result.get("outcome", "UNRESOLVED")).strip()
        analysis = str(result.get("analysis", ""))

        if outcome == "UNRESOLVED" or outcome not in outcomes:
            raise gl.vm.UserError("market is not resolvable yet (outcome: " + outcome + ")")

        # finalise the market (storage view -> writes persist)
        market.resolved = True
        market.winning_outcome = outcome
        market.analysis = analysis

        # score predictions for this market and award points to the winners
        for p in self.predictions:
            if p.market_id == market_id and not p.scored:
                p.scored = True
                if p.outcome == outcome:
                    p.correct = True
                    self.points[p.player] = self.points.get(p.player, u256(0)) + u256(1)

        return result

    # ------------------------------------------------------------------
    # Read (view) methods
    # ------------------------------------------------------------------
    @gl.public.view
    def get_market_count(self) -> int:
        return len(self.markets)

    @gl.public.view
    def get_market(self, market_id: int) -> typing.Any:
        if market_id < 0 or market_id >= len(self.markets):
            raise gl.vm.UserError("market not found")
        m = self.markets[market_id]
        return {
            "id": market_id,
            "creator": m.creator.as_hex,
            "question": m.question,
            "resolution_url": m.resolution_url,
            "deadline": m.deadline,
            "resolved": m.resolved,
            "winning_outcome": m.winning_outcome,
            "analysis": m.analysis,
            "outcomes": self._split(m.outcomes_csv),
        }

    @gl.public.view
    def get_predictions(self, market_id: int) -> typing.Any:
        return [
            {
                "player": p.player.as_hex,
                "outcome": p.outcome,
                "scored": p.scored,
                "correct": p.correct,
            }
            for p in self.predictions
            if p.market_id == market_id
        ]

    @gl.public.view
    def get_points(self, player: str) -> int:
        return self.points.get(Address(player), u256(0))

    @gl.public.view
    def get_player_points(self, player: str) -> int:
        """Alias for get_points (used by the frontend)."""
        return self.points.get(Address(player), u256(0))

    @gl.public.view
    def get_markets(self) -> typing.Any:
        """Return all markets (used by the frontend to list them all at once)."""
        result = []
        for i in range(len(self.markets)):
            m = self.markets[i]
            prediction_count = 0
            for p in self.predictions:
                if p.market_id == i:
                    prediction_count += 1
            result.append({
                "id": i,
                "creator": m.creator.as_hex,
                "question": m.question,
                "resolution_url": m.resolution_url,
                "deadline": m.deadline,
                "resolved": m.resolved,
                "winning_outcome": m.winning_outcome,
                "analysis": m.analysis,
                "outcomes": self._split(m.outcomes_csv),
                "prediction_count": prediction_count,
            })
        return result
