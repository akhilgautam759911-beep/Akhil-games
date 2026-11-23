import { isSafeTrackCell, toGlobalTrackIndex } from './boardLayout';
import type { AIDifficulty, LegalMove, MatchState } from './types';

function countOpponentThreatsAt(state: MatchState, seatIndex: number, progress: number): number {
  if (progress < 0 || progress > 50) return 0;
  const mover = state.players[seatIndex];
  const globalIdx = toGlobalTrackIndex(mover.color, progress);
  if (globalIdx === null) return 0;
  if (isSafeTrackCell(globalIdx, state.rules.safeStarCells)) return 0;

  let threats = 0;
  for (const opp of state.players) {
    if (opp.seatIndex === seatIndex) continue;
    if (state.rules.teamMode && opp.teamIndex === mover.teamIndex) continue;

    for (const token of opp.tokens) {
      if (token.progress < 0 || token.progress > 50) continue;
      const oppIdx = toGlobalTrackIndex(opp.color, token.progress);
      if (oppIdx === null) continue;
      const dist = (globalIdx - oppIdx + 52) % 52;
      if (dist >= 1 && dist <= 6) {
        threats += 1;
      }
    }
  }
  return threats;
}

function scoreMove(state: MatchState, seatIndex: number, move: LegalMove, difficulty: AIDifficulty): number {
  const player = state.players[seatIndex];
  let score = 0;

  // 1. Finishing a token is always huge
  if (move.isFinish) {
    score += 120;
  }

  // 2. Capturing an opponent token
  if (move.captures.length > 0) {
    let victimProgressSum = 0;
    for (const cap of move.captures) {
      const victimToken = state.players[cap.seatIndex].tokens[cap.tokenIndex];
      victimProgressSum += Math.max(5, victimToken.progress);
    }
    score += 95 + victimProgressSum * 1.4;
  }

  // 3. Entering home stretch (completely safe!)
  if (move.fromProgress <= 50 && move.toProgress >= 51 && !move.isFinish) {
    score += 68;
  }

  // 4. Deploying from yard
  if (move.isDeploy) {
    const activeOnBoard = player.tokens.filter((t) => t.progress >= 0 && t.progress < 56).length;
    score += activeOnBoard === 0 ? 110 : 58;
  }

  // 5. Landing on a safe cell
  if (move.landsOnSafe && move.toProgress <= 50) {
    score += 36;
  }

  // 6. Threat avoidance (Hard / Expert)
  if (difficulty === 'hard' || difficulty === 'expert') {
    const threatsBefore = countOpponentThreatsAt(state, seatIndex, move.fromProgress);
    const threatsAfter = countOpponentThreatsAt(state, seatIndex, move.toProgress);
    const progressWeight = 0.6 + move.fromProgress / 56;
    score += threatsBefore * 24 * progressWeight;
    score -= threatsAfter * (difficulty === 'expert' ? 32 : 22) * progressWeight;

    // Bonus for forming a safe pair if rule active
    if (state.rules.safeDoubleStack && move.toProgress <= 50) {
      const destIdx = toGlobalTrackIndex(player.color, move.toProgress);
      const hasFriendlyMate = player.tokens.some(
        (t) => t.index !== move.tokenIndex && toGlobalTrackIndex(player.color, t.progress) === destIdx,
      );
      if (hasFriendlyMate) score += 26;
    }

    // Expert strategic lead push & avoiding breaking safe shelter needlessly
    if (difficulty === 'expert') {
      const wasSafe =
        move.fromProgress >= 0 &&
        move.fromProgress <= 50 &&
        isSafeTrackCell(toGlobalTrackIndex(player.color, move.fromProgress)!, state.rules.safeStarCells);
      if (wasSafe && threatsAfter > 0 && move.captures.length === 0) {
        score -= 18;
      }
      score += move.toProgress * 0.45;
    }
  } else {
    // Medium prefers advancing lead tokens moderately
    score += move.toProgress * 0.25;
  }

  return score;
}

/**
 * Selects an AI token index deterministically or with difficulty-appropriate noise.
 * Always returns one of the legal move token indices.
 */
export function chooseAIMove(
  state: MatchState,
  seatIndex: number,
  difficulty: AIDifficulty,
  rng: () => number = Math.random,
): number {
  const legal = state.legalMoves;
  if (legal.length === 0) {
    throw new Error('No legal moves available for AI');
  }
  if (legal.length === 1) {
    return legal[0].tokenIndex;
  }

  if (difficulty === 'easy') {
    // 55% random legal move, 45% greedy
    if (rng() < 0.55) {
      return legal[Math.floor(rng() * legal.length)].tokenIndex;
    }
  }

  let bestMove = legal[0];
  let bestScore = -Infinity;

  for (const move of legal) {
    let s = scoreMove(state, seatIndex, move, difficulty);
    if (difficulty === 'medium') {
      s += (rng() - 0.5) * 18;
    } else if (difficulty === 'hard') {
      s += (rng() - 0.5) * 4;
    }
    if (s > bestScore) {
      bestScore = s;
      bestMove = move;
    }
  }

  return bestMove.tokenIndex;
}
