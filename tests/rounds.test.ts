import { describe, expect, it } from "vitest";
import {
  advanceMatch,
  createMatchState,
  type MatchSettings,
} from "../src/game/rounds";

const settings: MatchSettings = {
  scoreToWin: 2,
  roundOverDuration: 2.5,
};

describe("match rounds", () => {
  it("awards the sole survivor and starts a round-over interval", () => {
    const state = createMatchState(["player-1", "player-2"]);
    const update = advanceMatch(state, ["player-1"], 1 / 60, settings);

    expect(update.state.scores).toEqual({ "player-1": 1, "player-2": 0 });
    expect(update.state.phase).toBe("roundOver");
    expect(update.state.winnerId).toBe("player-1");
    expect(update.state.roundOverRemaining).toBe(settings.roundOverDuration);
    expect(update.startNextRound).toBe(false);
    expect(state.scores["player-1"]).toBe(0);
  });

  it("does not award a point when no players survive", () => {
    const state = createMatchState(["player-1", "player-2"]);
    const update = advanceMatch(state, [], 1 / 60, settings);

    expect(update.state.scores).toEqual({ "player-1": 0, "player-2": 0 });
    expect(update.state.phase).toBe("roundOver");
    expect(update.state.winnerId).toBeNull();
  });

  it("leaves a round active while multiple players remain", () => {
    const state = createMatchState(["player-1", "player-2"]);
    const update = advanceMatch(
      state,
      ["player-1", "player-2"],
      1 / 60,
      settings,
    );

    expect(update.state).toBe(state);
    expect(update.startNextRound).toBe(false);
  });

  it("starts exactly one new round when the banner interval expires", () => {
    const roundOver = advanceMatch(
      createMatchState(["player-1", "player-2"]),
      ["player-2"],
      1 / 60,
      settings,
    ).state;
    const beforeExpiry = advanceMatch(roundOver, [], 2, settings);
    const afterExpiry = advanceMatch(
      beforeExpiry.state,
      [],
      1,
      settings,
    );
    const nextTick = advanceMatch(
      afterExpiry.state,
      ["player-1", "player-2"],
      1 / 60,
      settings,
    );

    expect(beforeExpiry.startNextRound).toBe(false);
    expect(afterExpiry.state.round).toBe(2);
    expect(afterExpiry.state.phase).toBe("playing");
    expect(afterExpiry.state.scores["player-2"]).toBe(1);
    expect(afterExpiry.startNextRound).toBe(true);
    expect(nextTick.startNextRound).toBe(false);
  });

  it("ends the match when a survivor reaches the target score", () => {
    let state = createMatchState(["player-1", "player-2"]);
    for (let point = 0; point < settings.scoreToWin - 1; point += 1) {
      state = advanceMatch(state, ["player-1"], 1 / 60, settings).state;
      state = advanceMatch(state, [], settings.roundOverDuration, settings).state;
    }

    const matchOver = advanceMatch(state, ["player-1"], 1 / 60, settings);
    const later = advanceMatch(matchOver.state, [], 10, settings);

    expect(matchOver.state.phase).toBe("matchOver");
    expect(matchOver.state.winnerId).toBe("player-1");
    expect(matchOver.state.scores["player-1"]).toBe(settings.scoreToWin);
    expect(matchOver.state.roundOverRemaining).toBe(0);
    expect(later.state).toBe(matchOver.state);
    expect(later.startNextRound).toBe(false);
  });
});
