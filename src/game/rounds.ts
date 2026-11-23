export type MatchPhase = "playing" | "roundOver" | "matchOver";

export interface MatchState {
  round: number;
  phase: MatchPhase;
  scores: Record<string, number>;
  winnerId: string | null;
  roundOverRemaining: number;
}

export interface MatchSettings {
  scoreToWin: number;
  roundOverDuration: number;
}

export interface MatchUpdate {
  state: MatchState;
  startNextRound: boolean;
}

export function createMatchState(playerIds: readonly string[]): MatchState {
  return {
    round: 1,
    phase: "playing",
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    winnerId: null,
    roundOverRemaining: 0,
  };
}

export function advanceMatch(
  state: MatchState,
  alivePlayerIds: readonly string[],
  deltaSeconds: number,
  settings: MatchSettings,
): MatchUpdate {
  if (state.phase === "playing") {
    if (alivePlayerIds.length > 1) {
      return { state, startNextRound: false };
    }

    const winnerId = alivePlayerIds[0] ?? null;
    const scores = { ...state.scores };
    if (winnerId !== null) {
      scores[winnerId] = (scores[winnerId] ?? 0) + 1;
    }
    const matchOver =
      winnerId !== null && scores[winnerId]! >= settings.scoreToWin;

    return {
      state: {
        ...state,
        scores,
        phase: matchOver ? "matchOver" : "roundOver",
        winnerId,
        roundOverRemaining: matchOver ? 0 : settings.roundOverDuration,
      },
      startNextRound: false,
    };
  }

  if (state.phase === "roundOver") {
    const roundOverRemaining = Math.max(
      0,
      state.roundOverRemaining - deltaSeconds,
    );
    if (roundOverRemaining === 0) {
      return {
        state: {
          ...state,
          round: state.round + 1,
          phase: "playing",
          winnerId: null,
          roundOverRemaining: 0,
        },
        startNextRound: true,
      };
    }
    return {
      state: { ...state, roundOverRemaining },
      startNextRound: false,
    };
  }

  return { state, startNextRound: false };
}
