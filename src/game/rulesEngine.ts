import { getTokenGridCoord, isSafeTrackCell, toGlobalTrackIndex } from './boardLayout';
import type { GridCoord } from './boardLayout';
import {
  DEFAULT_RULES,
  type GameMode,
  type LegalMove,
  type MatchEvent,
  type MatchState,
  type PlayerColor,
  type PlayerConfigInput,
  type PlayerSlot,
  type RuleVariations,
} from './types';

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    rules: { ...state.rules },
    players: state.players.map((p) => ({
      ...p,
      tokens: p.tokens.map((t) => ({ ...t })),
    })),
    legalMoves: state.legalMoves.map((m) => ({
      ...m,
      captures: m.captures.map((c) => ({ ...c })),
    })),
    winnerSeats: [...state.winnerSeats],
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}

export function createInitialMatchState(params: {
  matchId: string;
  mode: GameMode;
  players: PlayerConfigInput[];
  rules?: Partial<RuleVariations>;
  startedAt?: number;
}): MatchState {
  if (params.players.length < 2 || params.players.length > 4) {
    throw new Error(`Ludo requires 2 to 4 players, received ${params.players.length}`);
  }

  const rules: RuleVariations = { ...DEFAULT_RULES, ...(params.rules ?? {}) };
  if (rules.teamMode && params.players.length !== 4) {
    rules.teamMode = false;
  }

  const slots: PlayerSlot[] = params.players.map((cfg, seatIndex) => {
    const teamIndex = rules.teamMode
      ? cfg.color === 'red' || cfg.color === 'yellow'
        ? 0
        : 1
      : seatIndex;
    return {
      seatIndex,
      color: cfg.color,
      name: cfg.name,
      avatar: cfg.avatar,
      kind: cfg.kind,
      aiDifficulty: cfg.aiDifficulty,
      clientId: cfg.clientId,
      connected: true,
      teamIndex,
      tokens: [0, 1, 2, 3].map((idx) => ({
        index: idx,
        color: cfg.color,
        progress: -1,
      })),
      captures: 0,
      finishedCount: 0,
    };
  });

  const firstEvent: MatchEvent = {
    id: 1,
    type: 'match_start',
    seatIndex: 0,
    color: slots[0].color,
    message: `${slots[0].name} opens the match`,
  };

  return {
    matchId: params.matchId,
    mode: params.mode,
    rules,
    players: slots,
    currentTurnSeat: 0,
    phase: 'waiting_roll',
    diceValue: null,
    consecutiveSixes: 0,
    legalMoves: [],
    winnerSeats: [],
    turnCount: 1,
    eventSeq: 1,
    lastEvent: firstEvent,
    startedAt: params.startedAt ?? Date.now(),
  };
}

function findCapturesAtTrackCell(
  state: MatchState,
  moverSeat: number,
  globalTrackIdx: number,
): Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }> {
  if (isSafeTrackCell(globalTrackIdx, state.rules.safeStarCells)) {
    return [];
  }

  const mover = state.players[moverSeat];
  const capturesBySeat = new Map<number, Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }>>();

  for (const opponent of state.players) {
    if (opponent.seatIndex === moverSeat) continue;
    if (state.rules.teamMode && opponent.teamIndex === mover.teamIndex) continue;

    for (const token of opponent.tokens) {
      const oppTrackIdx = toGlobalTrackIndex(opponent.color, token.progress);
      if (oppTrackIdx === globalTrackIdx) {
        const list = capturesBySeat.get(opponent.seatIndex) ?? [];
        list.push({ seatIndex: opponent.seatIndex, tokenIndex: token.index, color: opponent.color });
        capturesBySeat.set(opponent.seatIndex, list);
      }
    }
  }

  const result: Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }> = [];
  for (const [, tokensAtCell] of capturesBySeat.entries()) {
    // Optional variation: double-stacked friendly tokens are safe from capture
    if (state.rules.safeDoubleStack && tokensAtCell.length >= 2) {
      continue;
    }
    result.push(...tokensAtCell);
  }
  return result;
}

export function getLegalMoves(state: MatchState, seatIndex: number, diceValue: number): LegalMove[] {
  if (diceValue < 1 || diceValue > 6 || !Number.isInteger(diceValue)) {
    return [];
  }
  const player = state.players[seatIndex];
  if (!player) return [];

  const moves: LegalMove[] = [];
  for (const token of player.tokens) {
    if (token.progress === 56) continue;

    if (token.progress === -1) {
      const canExit = !state.rules.requireSixToExit
        ? true
        : state.rules.allowOneOrSixToExit
          ? diceValue === 6 || diceValue === 1
          : diceValue === 6;
      if (!canExit) continue;

      const destGlobal = toGlobalTrackIndex(player.color, 0)!;
      const captures = findCapturesAtTrackCell(state, seatIndex, destGlobal);
      moves.push({
        tokenIndex: token.index,
        fromProgress: -1,
        toProgress: 0,
        isDeploy: true,
        isFinish: false,
        captures,
        landsOnSafe: isSafeTrackCell(destGlobal, state.rules.safeStarCells),
      });
      continue;
    }

    const toProgress = token.progress + diceValue;
    if (toProgress > 56) continue; // Exact roll required to finish

    const isFinish = toProgress === 56;
    const destGlobal = toGlobalTrackIndex(player.color, toProgress);
    const captures = destGlobal !== null ? findCapturesAtTrackCell(state, seatIndex, destGlobal) : [];
    const landsOnSafe =
      toProgress >= 51 || (destGlobal !== null && isSafeTrackCell(destGlobal, state.rules.safeStarCells));

    moves.push({
      tokenIndex: token.index,
      fromProgress: token.progress,
      toProgress,
      isDeploy: false,
      isFinish,
      captures,
      landsOnSafe,
    });
  }

  return moves;
}

export function applyRoll(state: MatchState, seatIndex: number, diceValue: number): MatchState {
  if (state.phase !== 'waiting_roll') {
    throw new Error(`Cannot roll dice in phase "${state.phase}"`);
  }
  if (seatIndex !== state.currentTurnSeat) {
    throw new Error(`Not seat ${seatIndex}'s turn (current turn is seat ${state.currentTurnSeat})`);
  }
  if (!Number.isInteger(diceValue) || diceValue < 1 || diceValue > 6) {
    throw new Error(`Invalid dice value: ${diceValue}`);
  }

  const next = cloneState(state);
  const player = next.players[seatIndex];
  next.diceValue = diceValue;
  next.consecutiveSixes = diceValue === 6 ? next.consecutiveSixes + 1 : 0;

  // Optional Triple-Six penalty: rolling three consecutive 6s forfeits turn immediately
  if (next.rules.tripleSixPenalty && next.consecutiveSixes >= 3) {
    next.legalMoves = [];
    next.phase = 'no_moves';
    next.eventSeq += 1;
    next.lastEvent = {
      id: next.eventSeq,
      type: 'triple_six_forfeit',
      seatIndex,
      color: player.color,
      diceValue,
      message: `${player.name} rolled three 6s — turn forfeited!`,
    };
    return next;
  }

  const legalMoves = getLegalMoves(next, seatIndex, diceValue);
  next.legalMoves = legalMoves;
  next.eventSeq += 1;

  if (legalMoves.length === 0) {
    next.phase = 'no_moves';
    next.lastEvent = {
      id: next.eventSeq,
      type: 'no_moves',
      seatIndex,
      color: player.color,
      diceValue,
      message: `${player.name} rolled ${diceValue} — no legal moves`,
    };
  } else {
    next.phase = 'selecting_token';
    next.lastEvent = {
      id: next.eventSeq,
      type: 'rolled',
      seatIndex,
      color: player.color,
      diceValue,
      message: `${player.name} rolled ${diceValue}`,
    };
  }

  return next;
}

export function advanceTurnAfterNoMoves(state: MatchState): MatchState {
  if (state.phase !== 'no_moves') {
    throw new Error(`Cannot advance turn from phase "${state.phase}"`);
  }
  const next = cloneState(state);
  const nextSeat = (next.currentTurnSeat + 1) % next.players.length;
  next.currentTurnSeat = nextSeat;
  next.phase = 'waiting_roll';
  next.diceValue = null;
  next.consecutiveSixes = 0;
  next.legalMoves = [];
  next.turnCount += 1;
  next.eventSeq += 1;
  next.lastEvent = {
    id: next.eventSeq,
    type: 'turn_changed',
    seatIndex: nextSeat,
    color: next.players[nextSeat].color,
    message: `${next.players[nextSeat].name}'s turn`,
  };
  return next;
}

function checkWinnerSeats(state: MatchState): number[] {
  if (state.rules.teamMode) {
    const team0 = state.players.filter((p) => p.teamIndex === 0);
    const team1 = state.players.filter((p) => p.teamIndex === 1);
    if (team0.length > 0 && team0.every((p) => p.finishedCount === 4)) {
      return team0.map((p) => p.seatIndex);
    }
    if (team1.length > 0 && team1.every((p) => p.finishedCount === 4)) {
      return team1.map((p) => p.seatIndex);
    }
    return [];
  }

  const finishedPlayer = state.players.find((p) => p.finishedCount === 4);
  return finishedPlayer ? [finishedPlayer.seatIndex] : [];
}

export function applyMove(state: MatchState, seatIndex: number, tokenIndex: number): MatchState {
  if (state.phase !== 'selecting_token') {
    throw new Error(`Cannot move token in phase "${state.phase}"`);
  }
  if (seatIndex !== state.currentTurnSeat) {
    throw new Error(`Not seat ${seatIndex}'s turn`);
  }

  const chosen = state.legalMoves.find((m) => m.tokenIndex === tokenIndex);
  if (!chosen) {
    throw new Error(`Illegal move: seat ${seatIndex} token ${tokenIndex} with dice ${state.diceValue}`);
  }

  const next = cloneState(state);
  const player = next.players[seatIndex];
  const token = player.tokens[tokenIndex];
  const rolledValue = next.diceValue ?? 0;

  token.progress = chosen.toProgress;
  if (chosen.isFinish) {
    player.finishedCount = player.tokens.filter((t) => t.progress === 56).length;
  }

  // Apply captures
  if (chosen.captures.length > 0) {
    for (const cap of chosen.captures) {
      const victim = next.players[cap.seatIndex];
      victim.tokens[cap.tokenIndex].progress = -1;
    }
    player.captures += chosen.captures.length;
  }

  // Check victory
  const winnerSeats = checkWinnerSeats(next);
  if (winnerSeats.length > 0) {
    next.winnerSeats = winnerSeats;
    next.phase = 'finished';
    next.legalMoves = [];
    next.eventSeq += 1;
    const winnerNames = winnerSeats.map((s) => next.players[s].name).join(' & ');
    next.lastEvent = {
      id: next.eventSeq,
      type: 'victory',
      seatIndex,
      color: player.color,
      diceValue: rolledValue,
      tokenIndex,
      fromProgress: chosen.fromProgress,
      toProgress: chosen.toProgress,
      capturedTokens: chosen.captures,
      message: `${winnerNames} wins the match!`,
    };
    return next;
  }

  // Determine extra turn
  const extraTurn =
    (rolledValue === 6 && next.rules.extraTurnOnSix) ||
    (chosen.captures.length > 0 && next.rules.extraTurnOnCapture) ||
    (chosen.isFinish && next.rules.extraTurnOnFinish);

  next.eventSeq += 1;
  if (chosen.captures.length > 0) {
    next.lastEvent = {
      id: next.eventSeq,
      type: 'captured',
      seatIndex,
      color: player.color,
      diceValue: rolledValue,
      tokenIndex,
      fromProgress: chosen.fromProgress,
      toProgress: chosen.toProgress,
      capturedTokens: chosen.captures,
      message: `${player.name} captured ${chosen.captures.map((c) => c.color).join(', ')}! Bonus turn!`,
    };
  } else if (chosen.isFinish) {
    next.lastEvent = {
      id: next.eventSeq,
      type: 'token_finished',
      seatIndex,
      color: player.color,
      diceValue: rolledValue,
      tokenIndex,
      fromProgress: chosen.fromProgress,
      toProgress: chosen.toProgress,
      message: `${player.name} brought a token Home!`,
    };
  } else if (chosen.isDeploy) {
    next.lastEvent = {
      id: next.eventSeq,
      type: 'deployed',
      seatIndex,
      color: player.color,
      diceValue: rolledValue,
      tokenIndex,
      fromProgress: chosen.fromProgress,
      toProgress: chosen.toProgress,
      message: `${player.name} deployed a token`,
    };
  } else {
    next.lastEvent = {
      id: next.eventSeq,
      type: 'moved',
      seatIndex,
      color: player.color,
      diceValue: rolledValue,
      tokenIndex,
      fromProgress: chosen.fromProgress,
      toProgress: chosen.toProgress,
      message: `${player.name} moved ${rolledValue} spaces`,
    };
  }

  if (extraTurn) {
    next.phase = 'waiting_roll';
    next.diceValue = null;
    next.legalMoves = [];
    // Keep consecutiveSixes only if extra turn was triggered by a 6; reset if triggered by capture/finish on non-6
    if (rolledValue !== 6) {
      next.consecutiveSixes = 0;
    }
  } else {
    next.currentTurnSeat = (next.currentTurnSeat + 1) % next.players.length;
    next.phase = 'waiting_roll';
    next.diceValue = null;
    next.consecutiveSixes = 0;
    next.legalMoves = [];
    next.turnCount += 1;
  }

  return next;
}

/**
 * Computes step-by-step board coordinates for animating a token hop across intermediate cells.
 */
export function getStepWaypoints(
  color: PlayerColor,
  tokenIndex: number,
  fromProgress: number,
  toProgress: number,
): GridCoord[] {
  if (fromProgress < 0) {
    return [getTokenGridCoord(color, tokenIndex, toProgress)];
  }
  const coords: GridCoord[] = [];
  for (let p = fromProgress + 1; p <= toProgress; p++) {
    coords.push(getTokenGridCoord(color, tokenIndex, p));
  }
  return coords;
}
