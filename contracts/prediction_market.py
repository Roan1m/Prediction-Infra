# { "Depends": "py-genlayer:test" }
#
# PredictionMarket - an Intelligent Contract for GenLayer.
#
# A general-purpose, AI-resolved prediction market:
#   - Anyone can create a market: a question, a public resolution URL, and a
#     list of possible outcomes.
#   - Players predict an outcome (one prediction per player per market).
#   - Anyone can `resolve` a market once the event has happened. Resolution is
#     done by GenLayer validators: they fetch the resolution URL from the live
#     web and ask an LLM which outcome the evidence supports. Consensus is
#     reached with the Equivalence Principle (validators only have to agree on
#     the *decision* field, not on the free-form analysis text).
#   - Correct predictors earn 1 point.
#
# This contract is points-based (no native token transfers), so it runs fully
# in the GenLayer Studio. See README for a "betting" extension idea.

from genlayer import *

import json
import typing
from dataclasses import dataclass


@allow_storage
@dataclass
class Prediction:
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
    resolved: bool
    winning_outcome: str
    analysis: str


class PredictionMarket(gl.Contract):
    # ---- persistent storage (declared as typed class fields) ----
    market_count: u256
    markets: TreeMap[u256, Market]
    market_outcomes: TreeMap[u256, DynArray[str]]
    predictions: TreeMap[u256, DynArray[Prediction]]
    points: TreeMap[Address, u256]

    def __init__(self) -> None:
        self.market_count = u256(0)

    # ------------------------------------------------------------------
    # Write methods
    # ------------------------------------------------------------------
    @gl.public.write
    def create_market(
        self,
        question: str,
        resolution_url: str,
        outcomes: list[str],
        deadline: str,
    ) -> u256:
        """Create a new prediction market and return its id."""
        if len(outcomes) < 2:
            raise gl.vm.UserError("a market needs at least two outcomes")

        market_id = self.market_count

        self.markets[market_id] = Market(
            creator=gl.message.sender_address,
            question=question,
            resolution_url=resolution_url,
            deadline=deadline,
            resolved=False,
            winning_outcome="",
            analysis="",
        )

        # initialise the per-market collections
        self.market_outcomes[market_id] = DynArray[str]()
        for outcome in outcomes:
            self.market_outcomes[market_id].append(outcome)

        self.predictions[market_id] = DynArray[Prediction]()

        self.market_count = market_id + u256(1)
        return market_id

    @gl.public.write
    def predict(self, market_id: u256, outcome: str) -> None:
        """Register the caller's prediction for a market."""
        if market_id not in self.markets:
            raise gl.vm.UserError("market not found")

        market = self.markets[market_id]
        if market.resolved:
            raise gl.vm.UserError("market already resolved")

        # the chosen outcome must be one of the market's outcomes
        valid = False
        for o in self.market_outcomes[market_id]:
            if o == outcome:
                valid = True
                break
        if not valid:
            raise gl.vm.UserError("invalid outcome for this market")

        # one prediction per player per market
        sender = gl.message.sender_address
        for pred in self.predictions[market_id]:
            if pred.player == sender:
                raise gl.vm.UserError("you already predicted on this market")

        self.predictions[market_id].append(
            Prediction(
                player=sender,
                outcome=outcome,
                scored=False,
                correct=False,
            )
        )

    @gl.public.write
    def resolve(self, market_id: u256) -> typing.Any:
        """
        Resolve a market using live web data + an LLM, with validator consensus.

        The leader fetches the resolution URL and asks an LLM which outcome the
        evidence supports. Validators independently do the same and only need to
        agree on the `outcome` field (the analysis text is allowed to differ).
        """
        if market_id not in self.markets:
            raise gl.vm.UserError("market not found")

        market = self.markets[market_id]
        if market.resolved:
            raise gl.vm.UserError("market already resolved")

        # copy everything we need into plain memory BEFORE the nondet block:
        # storage is not accessible inside non-deterministic blocks.
        url = market.resolution_url
        question = market.question
        outcomes = [o for o in self.market_outcomes[market_id]]

        def leader_fn() -> typing.Any:
            response = gl.nondet.web.get(url)
            page = response.body.decode("utf-8")
            # keep the prompt bounded
            page = page[:8000]

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
            # reject if the leader errored
            if not isinstance(leader_result, gl.vm.Return):
                return False
            mine = leader_fn()
            leader_outcome = str(leader_result.calldata.get("outcome", "")).strip()
            my_outcome = str(mine.get("outcome", "")).strip()
            # consensus only on the decision, not on the analysis text
            return leader_outcome == my_outcome

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        outcome = str(result.get("outcome", "UNRESOLVED")).strip()
        analysis = str(result.get("analysis", ""))

        # do not finalise if the event is not decidable yet
        if outcome == "UNRESOLVED" or outcome not in outcomes:
            raise gl.vm.UserError("market is not resolvable yet (outcome: " + outcome + ")")

        # finalise the market (market is a live storage view -> writes persist)
        market.resolved = True
        market.winning_outcome = outcome
        market.analysis = analysis

        # score every prediction and award points to the winners
        for pred in self.predictions[market_id]:
            if not pred.scored:
                pred.scored = True
                if pred.outcome == outcome:
                    pred.correct = True
                    self.points[pred.player] = self.points.get(pred.player, u256(0)) + u256(1)

        return result

    # ------------------------------------------------------------------
    # Read (view) methods
    # ------------------------------------------------------------------
    @gl.public.view
    def get_market_count(self) -> u256:
        return self.market_count

    @gl.public.view
    def get_market(self, market_id: u256) -> typing.Any:
        if market_id not in self.markets:
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
            "outcomes": [o for o in self.market_outcomes[market_id]],
        }

    @gl.public.view
    def get_predictions(self, market_id: u256) -> typing.Any:
        if market_id not in self.predictions:
            return []
        return [
            {
                "player": p.player.as_hex,
                "outcome": p.outcome,
                "scored": p.scored,
                "correct": p.correct,
            }
            for p in self.predictions[market_id]
        ]

    @gl.public.view
    def get_points(self, player: str) -> u256:
        return self.points.get(Address(player), u256(0))
