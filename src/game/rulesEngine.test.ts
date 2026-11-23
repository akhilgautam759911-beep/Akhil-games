import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAIN_TRACK_COORDS,
  START_TRACK_INDEX,
  getActiveColorsForCount,
  getTokenGridCoord,
  isSafeTrackCell,
  toGlobalTrackIndex,
} from './boardLayout';
import {
  advanceTurnAfterNoMoves,
  applyMove,
  applyRoll,
  createInitialMatchState,
  getLegalMoves,
} from './rulesEngine';
import { chooseAIMove } from './aiManager';

test('board layout has 52 unique outer track cells and aligned player start offsets', () => {
  assert.equal(MAIN_TRACK_COORDS.length, 52);
  const coordKeys = new Set(MAIN_TRACK_COORDS.map((c) => `${c.col},${c.row}`));
  assert.equal(coordKeys.size, 52);

  assert.equal(START_TRACK_INDEX.red, 0);
  assert.equal(START_TRACK_INDEX.green, 13);
  assert.equal(START_TRACK_INDEX.yellow, 26);
  assert.equal(START_TRACK_INDEX.blue, 39);

  // Every player's progress=50 lands right before their own home stretch
  assert.deepEqual(getTokenGridCoord('red', 0, 50), { col: 0, row: 7 });
  assert.deepEqual(getTokenGridCoord('red', 0, 51), { col: 1, row: 7 });
  assert.deepEqual(getTokenGridCoord('green', 0, 50), { col: 7, row: 0 });
  assert.deepEqual(getTokenGridCoord('green', 0, 51), { col: 7, row: 1 });
  assert.deepEqual(getTokenGridCoord('yellow', 0, 50), { col: 14, row: 7 });
  assert.deepEqual(getTokenGridCoord('yellow', 0, 51), { col: 13, row: 7 });
  assert.deepEqual(getTokenGridCoord('blue', 0, 50), { col: 7, row: 14 });
  assert.deepEqual(getTokenGridCoord('blue', 0, 51), { col: 7, row: 13 });
});

test('2-player setup places players on opposite corners (Red & Yellow)', () => {
  const colors = getActiveColorsForCount(2);
  assert.deepEqual(colors, ['red', 'yellow']);
});

test('requiring a 6 to exit yard blocks rolls 1-5 and allows 6 with extra turn', () => {
  let state = createInitialMatchState({
    matchId: 't1',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'P1', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'P2', avatar: 'knight', kind: 'human' },
    ],
  });

  // Rolling 1..5 in yard yields no legal moves
  for (const roll of [1, 2, 3, 4, 5]) {
    const rolled = applyRoll(state, 0, roll);
    assert.equal(rolled.legalMoves.length, 0);
    assert.equal(rolled.phase, 'no_moves');
    const skipped = advanceTurnAfterNoMoves(rolled);
    assert.equal(skipped.currentTurnSeat, 1);
    assert.equal(skipped.phase, 'waiting_roll');
  }

  // Rolling 6 allows deploying all 4 tokens and keeps turn after moving
  state = applyRoll(state, 0, 6);
  assert.equal(state.legalMoves.length, 4);
  assert.equal(state.phase, 'selecting_token');

  state = applyMove(state, 0, 0);
  assert.equal(state.players[0].tokens[0].progress, 0);
  assert.equal(state.currentTurnSeat, 0); // Extra turn on 6!
  assert.equal(state.phase, 'waiting_roll');
});

test('capturing an opponent on a non-safe cell sends victim back to yard and grants bonus turn', () => {
  let state = createInitialMatchState({
    matchId: 't2',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'Yellow', avatar: 'knight', kind: 'human' },
    ],
  });

  // Put Red token 0 at progress 28 (global track 28, non-safe)
  // Put Yellow token 0 at progress 2 (global track (26+2)%52 = 28, non-safe)
  state.players[0].tokens[0].progress = 25;
  state.players[1].tokens[0].progress = 2;
  assert.equal(isSafeTrackCell(28, true), false);
  assert.equal(toGlobalTrackIndex('yellow', 2), 28);

  state = applyRoll(state, 0, 3);
  assert.equal(state.legalMoves.length, 1);
  assert.equal(state.legalMoves[0].captures.length, 1);

  state = applyMove(state, 0, 0);
  assert.equal(state.players[0].tokens[0].progress, 28);
  assert.equal(state.players[1].tokens[0].progress, -1); // Captured back to yard!
  assert.equal(state.players[0].captures, 1);
  assert.equal(state.currentTurnSeat, 0); // Bonus turn on capture!
});

test('safe cells (start and star) protect opponent tokens from capture', () => {
  let state = createInitialMatchState({
    matchId: 't3',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'green', name: 'Green', avatar: 'knight', kind: 'human' },
    ],
  });

  // Star cell at global index 8 -> Red progress 8; Green starts at 13 so track 8 is safe
  state.players[0].tokens[0].progress = 5;
  state.players[1].tokens[0].progress = 47; // (13 + 47) % 52 = 8 (Star safe cell!)
  assert.equal(toGlobalTrackIndex('green', 47), 8);
  assert.equal(isSafeTrackCell(8, true), true);

  state = applyRoll(state, 0, 3);
  assert.equal(state.legalMoves[0].captures.length, 0);
  state = applyMove(state, 0, 0);
  assert.equal(state.players[0].tokens[0].progress, 8);
  assert.equal(state.players[1].tokens[0].progress, 47); // Protected!
  assert.equal(state.currentTurnSeat, 1); // No bonus turn since no capture
});

test('exact dice roll is required to finish a token at progress 56', () => {
  let state = createInitialMatchState({
    matchId: 't4',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'Yellow', avatar: 'knight', kind: 'human' },
    ],
  });

  state.players[0].tokens[0].progress = 54; // Needs exactly 2 to finish (56)

  const movesWith3 = getLegalMoves(state, 0, 3);
  assert.equal(movesWith3.length, 0); // 54 + 3 = 57 > 56 -> illegal

  const movesWith2 = getLegalMoves(state, 0, 2);
  assert.equal(movesWith2.length, 1);
  assert.equal(movesWith2[0].isFinish, true);

  state = applyRoll(state, 0, 2);
  state = applyMove(state, 0, 0);
  assert.equal(state.players[0].tokens[0].progress, 56);
  assert.equal(state.players[0].finishedCount, 1);
  assert.equal(state.currentTurnSeat, 0); // Extra turn on finish!
});

test('winner is declared immediately when 4th token finishes', () => {
  let state = createInitialMatchState({
    matchId: 't5',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'Yellow', avatar: 'knight', kind: 'human' },
    ],
  });

  state.players[0].tokens[0].progress = 56;
  state.players[0].tokens[1].progress = 56;
  state.players[0].tokens[2].progress = 56;
  state.players[0].finishedCount = 3;
  state.players[0].tokens[3].progress = 55;

  state = applyRoll(state, 0, 1);
  state = applyMove(state, 0, 3);
  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.winnerSeats, [0]);
});

test('triple six penalty forfeits turn on third consecutive 6', () => {
  let state = createInitialMatchState({
    matchId: 't6',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'Yellow', avatar: 'knight', kind: 'human' },
    ],
    rules: { tripleSixPenalty: true },
  });

  state = applyRoll(state, 0, 6);
  state = applyMove(state, 0, 0);
  assert.equal(state.consecutiveSixes, 1);

  state = applyRoll(state, 0, 6);
  state = applyMove(state, 0, 1);
  assert.equal(state.consecutiveSixes, 2);

  state = applyRoll(state, 0, 6);
  assert.equal(state.phase, 'no_moves');
  assert.equal(state.lastEvent?.type, 'triple_six_forfeit');
  state = advanceTurnAfterNoMoves(state);
  assert.equal(state.currentTurnSeat, 1);
  assert.equal(state.consecutiveSixes, 0);
});

test('invalid turn, invalid dice, and illegal token selection throw errors', () => {
  let state = createInitialMatchState({
    matchId: 't7',
    mode: 'pass_and_play',
    players: [
      { color: 'red', name: 'Red', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'Yellow', avatar: 'knight', kind: 'human' },
    ],
  });

  assert.throws(() => applyRoll(state, 1, 4)); // Wrong turn
  assert.throws(() => applyRoll(state, 0, 7)); // Invalid dice
  state = applyRoll(state, 0, 6);
  assert.throws(() => applyMove(state, 0, 9)); // Non-existent token
});

test('AI manager selects legal moves across all 4 difficulties and prioritizes finishes & captures', () => {
  let state = createInitialMatchState({
    matchId: 't8',
    mode: 'vs_ai',
    players: [
      { color: 'red', name: 'Human', avatar: 'crown', kind: 'human' },
      { color: 'yellow', name: 'AI', avatar: 'knight', kind: 'ai', aiDifficulty: 'expert' },
    ],
  });

  state.currentTurnSeat = 1;
  state.players[1].tokens[0].progress = 10;
  state.players[1].tokens[1].progress = 53; // Needs 3 to finish
  state.players[0].tokens[0].progress = 39; // Global = 39; Yellow at 10+3 = 13 -> global (26+13)%52 = 39 (Start safe! Let's use 40)
  state.players[0].tokens[0].progress = 40; // Global 40 (non-safe!) -> Yellow progress 14 = (26+14)%52=40!
  state.players[1].tokens[2].progress = 11; // Moving 3 captures Red!

  state = applyRoll(state, 1, 3);
  const legalIds = new Set(state.legalMoves.map((m) => m.tokenIndex));

  for (const diff of ['easy', 'medium', 'hard', 'expert'] as const) {
    const choice = chooseAIMove(state, 1, diff, () => 0.1);
    assert.equal(legalIds.has(choice), true);
  }

  // Expert AI must pick finishing token 1 or capturing token 2 over plain move token 0
  const expertChoice = chooseAIMove(state, 1, 'expert');
  assert.ok(expertChoice === 1 || expertChoice === 2);
});
