"""
Direct-mode tests for the PredictionMarket Intelligent Contract.

Run with:   pytest tests/ -v

Direct mode runs the contract in-memory (no Studio / Docker needed). Web and
LLM calls are mocked with the `direct_vm.mock_web` / `direct_vm.mock_llm`
cheatcodes.

`outcomes` is passed to `create_market` as a comma-separated string.
"""

import json

CONTRACT = "contracts/prediction_market.py"


def test_create_and_read_market(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    market_id = contract.create_market(
        "Who wins Brazil vs Jamaica?",
        "https://example.com/match",
        "Brazil, Jamaica, Draw",
        "2025-07-01T00:00:00+00:00",
    )

    assert contract.get_market_count() == 1

    market = contract.get_market(market_id)
    assert market["question"].startswith("Who wins")
    assert market["resolved"] is False
    assert "Brazil" in market["outcomes"]
    assert len(market["outcomes"]) == 3


def test_create_market_requires_two_outcomes(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("at least two outcomes"):
        contract.create_market("Q?", "https://example.com", "OnlyOne", "")


def test_predict_validates_outcome(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    market_id = contract.create_market(
        "Q?", "https://example.com/m", "Brazil, Jamaica, Draw", ""
    )
    with direct_vm.expect_revert("invalid outcome"):
        contract.predict(market_id, "Spain")


def test_no_double_prediction(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    market_id = contract.create_market(
        "Q?", "https://example.com/m", "Brazil, Jamaica, Draw", ""
    )
    contract.predict(market_id, "Brazil")
    with direct_vm.expect_revert("already predicted"):
        contract.predict(market_id, "Jamaica")


def test_predict_resolve_and_score(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)

    direct_vm.sender = direct_alice
    market_id = contract.create_market(
        "Who wins Brazil vs Jamaica?",
        "https://example.com/match",
        "Brazil, Jamaica, Draw",
        "",
    )

    # alice bets Brazil, bob bets Jamaica
    direct_vm.sender = direct_alice
    contract.predict(market_id, "Brazil")
    direct_vm.sender = direct_bob
    contract.predict(market_id, "Jamaica")

    # mock the web page + the LLM decision
    direct_vm.mock_web(
        r".*example\.com/match.*",
        {"status": 200, "body": "Final score: Brazil 2 - 1 Jamaica. Brazil won."},
    )
    direct_vm.mock_llm(
        r".*prediction market.*",
        json.dumps({"analysis": "Brazil won 2-1", "outcome": "Brazil"}),
    )

    direct_vm.sender = direct_alice
    contract.resolve(market_id)

    market = contract.get_market(market_id)
    assert market["resolved"] is True
    assert market["winning_outcome"] == "Brazil"

    # alice was right (1 point), bob was wrong (0 points)
    assert contract.get_points(str(direct_alice)) == 1
    assert contract.get_points(str(direct_bob)) == 0


def test_unresolved_event_does_not_finalize(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    market_id = contract.create_market(
        "Q?", "https://example.com/m", "Brazil, Jamaica, Draw", ""
    )

    direct_vm.mock_web(r".*example\.com/m.*", {"status": 200, "body": "Kick off 18:00"})
    direct_vm.mock_llm(
        r".*prediction market.*",
        json.dumps({"analysis": "not started", "outcome": "UNRESOLVED"}),
    )

    with direct_vm.expect_revert("not resolvable yet"):
        contract.resolve(market_id)

    assert contract.get_market(market_id)["resolved"] is False
