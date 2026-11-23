import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { chooseAIMove } from '../game/aiManager';
import { getActiveColorsForCount } from '../game/boardLayout';
import {
  advanceTurnAfterNoMoves,
  applyMove,
  applyRoll,
  createInitialMatchState,
} from '../game/rulesEngine';
import type { GameMode, MatchState, PlayerConfigInput } from '../game/types';

export interface LobbySeat {
  clientId: string;
  name: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  mode: GameMode;
  hostClientId: string;
  maxPlayers: 2 | 3 | 4;
  seats: LobbySeat[];
  status: 'lobby' | 'playing' | 'finished';
  matchState: MatchState | null;
  createdAt: number;
}

interface ClientConn {
  ws: WebSocket;
  clientId: string;
  roomCode: string | null;
  msgWindowStart: number;
  msgCount: number;
}

export class MultiplayerHub {
  private rooms = new Map<string, RoomInfo>();
  private clients = new Map<WebSocket, ClientConn>();
  private quickQueues: Record<'online_quick' | 'online_ranked', string[]> = {
    online_quick: [],
    online_ranked: [],
  };
  private aiTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private broadcastRoom(room: RoomInfo, payload: unknown): void {
    const serialized = JSON.stringify(payload);
    for (const conn of this.clients.values()) {
      if (conn.roomCode === room.code && conn.ws.readyState === conn.ws.OPEN) {
        conn.ws.send(serialized);
      }
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    return this.rooms.has(code) ? this.generateCode() : code;
  }

  public registerConnection(ws: WebSocket): void {
    const conn: ClientConn = {
      ws,
      clientId: '',
      roomCode: null,
      msgWindowStart: Date.now(),
      msgCount: 0,
    };
    this.clients.set(ws, conn);

    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - conn.msgWindowStart > 2000) {
        conn.msgWindowStart = now;
        conn.msgCount = 0;
      }
      conn.msgCount += 1;
      if (conn.msgCount > 40) {
        this.send(ws, { type: 'error', message: 'Rate limit exceeded' });
        return;
      }

      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        this.handleMessage(conn, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Malformed payload' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(conn);
    });
  }

  private handleDisconnect(conn: ClientConn): void {
    this.clients.delete(conn.ws);
    if (conn.clientId) {
      this.quickQueues.online_quick = this.quickQueues.online_quick.filter((id) => id !== conn.clientId);
      this.quickQueues.online_ranked = this.quickQueues.online_ranked.filter((id) => id !== conn.clientId);
    }

    if (conn.roomCode) {
      const room = this.rooms.get(conn.roomCode);
      if (room) {
        const seat = room.seats.find((s) => s.clientId === conn.clientId);
        if (seat) seat.connected = false;
        if (room.matchState) {
          const mp = room.matchState.players.find((p) => p.clientId === conn.clientId);
          if (mp) mp.connected = false;
          this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
        } else {
          this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
        }
      }
    }
  }

  private sanitizeRoom(room: RoomInfo) {
    return {
      code: room.code,
      mode: room.mode,
      hostClientId: room.hostClientId,
      maxPlayers: room.maxPlayers,
      seats: room.seats,
      status: room.status,
      matchState: room.matchState,
    };
  }

  private handleMessage(conn: ClientConn, msg: Record<string, unknown>): void {
    const type = String(msg.type ?? '');

    if (type === 'auth:identify') {
      conn.clientId = String(msg.clientId ?? '').slice(0, 64);
      const rejoinCode = typeof msg.roomCode === 'string' ? msg.roomCode.toUpperCase() : null;
      if (rejoinCode && this.rooms.has(rejoinCode)) {
        const room = this.rooms.get(rejoinCode)!;
        const existing = room.seats.find((s) => s.clientId === conn.clientId);
        if (existing) {
          existing.connected = true;
          if (room.matchState) {
            const mp = room.matchState.players.find((p) => p.clientId === conn.clientId);
            if (mp) mp.connected = true;
          }
          conn.roomCode = room.code;
          this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(room) });
          this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
          return;
        }
      }
      this.send(conn.ws, { type: 'auth:ack', clientId: conn.clientId });
      return;
    }

    if (!conn.clientId) {
      this.send(conn.ws, { type: 'error', message: 'Identify first' });
      return;
    }

    if (type === 'room:create') {
      const mode = (msg.mode as GameMode) || 'online_private';
      const maxPlayers = ([2, 3, 4].includes(Number(msg.maxPlayers)) ? Number(msg.maxPlayers) : 4) as 2 | 3 | 4;
      const code = this.generateCode();
      const room: RoomInfo = {
        code,
        mode,
        hostClientId: conn.clientId,
        maxPlayers,
        seats: [
          {
            clientId: conn.clientId,
            name: String(msg.name ?? 'Player').slice(0, 20),
            avatar: String(msg.avatar ?? 'crown'),
            ready: true,
            connected: true,
          },
        ],
        status: 'lobby',
        matchState: null,
        createdAt: Date.now(),
      };
      this.rooms.set(code, room);
      conn.roomCode = code;
      this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(room) });
      return;
    }

    if (type === 'room:join') {
      const code = String(msg.code ?? '').trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) {
        this.send(conn.ws, { type: 'error', message: `Room ${code} not found` });
        return;
      }

      const existing = room.seats.find((s) => s.clientId === conn.clientId);
      if (existing) {
        existing.connected = true;
        if (room.matchState) {
          const mp = room.matchState.players.find((p) => p.clientId === conn.clientId);
          if (mp) mp.connected = true;
        }
        conn.roomCode = code;
        this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(room) });
        this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
        return;
      }

      if (room.status !== 'lobby' || room.seats.length >= room.maxPlayers) {
        this.send(conn.ws, { type: 'error', message: 'Room is full or already started' });
        return;
      }

      room.seats.push({
        clientId: conn.clientId,
        name: String(msg.name ?? 'Challenger').slice(0, 20),
        avatar: String(msg.avatar ?? 'knight'),
        ready: true,
        connected: true,
      });
      conn.roomCode = code;
      this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(room) });
      this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
      return;
    }

    if (type === 'matchmaking:join') {
      const qMode = msg.mode === 'online_ranked' ? 'online_ranked' : 'online_quick';
      const maxPlayers = ([2, 3, 4].includes(Number(msg.maxPlayers)) ? Number(msg.maxPlayers) : 2) as 2 | 3 | 4;

      // Look for an open lobby room of matching mode
      let targetRoom: RoomInfo | undefined;
      for (const r of this.rooms.values()) {
        if (r.mode === qMode && r.status === 'lobby' && r.seats.length < r.maxPlayers) {
          targetRoom = r;
          break;
        }
      }

      if (targetRoom) {
        if (!targetRoom.seats.some((s) => s.clientId === conn.clientId)) {
          targetRoom.seats.push({
            clientId: conn.clientId,
            name: String(msg.name ?? 'Player').slice(0, 20),
            avatar: String(msg.avatar ?? 'phoenix'),
            ready: true,
            connected: true,
          });
        }
        conn.roomCode = targetRoom.code;
        this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(targetRoom) });
        this.broadcastRoom(targetRoom, { type: 'room:update', room: this.sanitizeRoom(targetRoom) });
        if (targetRoom.seats.length >= targetRoom.maxPlayers) {
          this.startMatchInRoom(targetRoom, false);
        }
      } else {
        const code = this.generateCode();
        const room: RoomInfo = {
          code,
          mode: qMode,
          hostClientId: conn.clientId,
          maxPlayers,
          seats: [
            {
              clientId: conn.clientId,
              name: String(msg.name ?? 'Player').slice(0, 20),
              avatar: String(msg.avatar ?? 'crown'),
              ready: true,
              connected: true,
            },
          ],
          status: 'lobby',
          matchState: null,
          createdAt: Date.now(),
        };
        this.rooms.set(code, room);
        conn.roomCode = code;
        this.send(conn.ws, { type: 'room:joined', room: this.sanitizeRoom(room) });
      }
      return;
    }

    if (type === 'room:leave') {
      if (conn.roomCode) {
        const room = this.rooms.get(conn.roomCode);
        conn.roomCode = null;
        if (room && room.status === 'lobby') {
          room.seats = room.seats.filter((s) => s.clientId !== conn.clientId);
          if (room.seats.length === 0) {
            this.rooms.delete(room.code);
          } else {
            if (room.hostClientId === conn.clientId) {
              room.hostClientId = room.seats[0].clientId;
            }
            this.broadcastRoom(room, { type: 'room:update', room: this.sanitizeRoom(room) });
          }
        }
      }
      return;
    }

    if (type === 'room:start') {
      const room = conn.roomCode ? this.rooms.get(conn.roomCode) : null;
      if (!room || room.hostClientId !== conn.clientId || room.status !== 'lobby') {
        this.send(conn.ws, { type: 'error', message: 'Only host can start lobby' });
        return;
      }
      const fillWithAi = Boolean(msg.fillWithAi ?? true);
      this.startMatchInRoom(room, fillWithAi);
      return;
    }

    if (type === 'match:roll') {
      const room = conn.roomCode ? this.rooms.get(conn.roomCode) : null;
      if (!room || !room.matchState || room.status !== 'playing') return;
      const state = room.matchState;
      const activePlayer = state.players[state.currentTurnSeat];
      if (activePlayer.clientId !== conn.clientId || state.phase !== 'waiting_roll') {
        this.send(conn.ws, { type: 'error', message: 'Not your turn to roll' });
        return;
      }

      // Server-authoritative cryptographically random 1..6 roll
      const diceValue = crypto.randomInt(1, 7);
      const rolled = applyRoll(state, state.currentTurnSeat, diceValue);
      room.matchState = rolled;
      this.broadcastRoom(room, { type: 'match:rolled', diceValue, seatIndex: state.currentTurnSeat, state: rolled });

      if (rolled.phase === 'no_moves') {
        setTimeout(() => {
          if (room.matchState?.phase === 'no_moves') {
            room.matchState = advanceTurnAfterNoMoves(room.matchState);
            this.broadcastRoom(room, { type: 'match:state', state: room.matchState });
            this.scheduleAiIfNeeded(room);
          }
        }, 1250);
      }
      return;
    }

    if (type === 'match:move') {
      const room = conn.roomCode ? this.rooms.get(conn.roomCode) : null;
      if (!room || !room.matchState || room.status !== 'playing') return;
      const state = room.matchState;
      const activePlayer = state.players[state.currentTurnSeat];
      if (activePlayer.clientId !== conn.clientId || state.phase !== 'selecting_token') {
        this.send(conn.ws, { type: 'error', message: 'Invalid move turn' });
        return;
      }

      const tokenIndex = Number(msg.tokenIndex);
      try {
        const moved = applyMove(state, state.currentTurnSeat, tokenIndex);
        room.matchState = moved;
        if (moved.phase === 'finished') {
          room.status = 'finished';
        }
        this.broadcastRoom(room, {
          type: 'match:moved',
          seatIndex: state.currentTurnSeat,
          tokenIndex,
          state: moved,
        });
        this.scheduleAiIfNeeded(room);
      } catch (err) {
        this.send(conn.ws, { type: 'error', message: (err as Error).message });
      }
    }
  }

  private startMatchInRoom(room: RoomInfo, fillWithAi: boolean): void {
    const totalCount = fillWithAi ? room.maxPlayers : Math.max(2, room.seats.length);
    const clampedCount = (totalCount <= 2 ? 2 : totalCount === 3 ? 3 : 4) as 2 | 3 | 4;
    const colors = getActiveColorsForCount(clampedCount);
    const aiNames = ['Atlas Bot', 'Nova Bot', 'Titan Bot', 'Orion Bot'];

    const configs: PlayerConfigInput[] = colors.map((color, idx) => {
      const human = room.seats[idx];
      if (human) {
        return {
          color,
          name: human.name,
          avatar: human.avatar,
          kind: 'remote',
          clientId: human.clientId,
        };
      }
      return {
        color,
        name: aiNames[idx % aiNames.length],
        avatar: 'knight',
        kind: 'ai',
        aiDifficulty: 'hard',
      };
    });

    room.matchState = createInitialMatchState({
      matchId: `online-${room.code}-${Date.now()}`,
      mode: room.mode,
      players: configs,
    });
    room.status = 'playing';
    this.broadcastRoom(room, { type: 'room:started', room: this.sanitizeRoom(room) });
    this.scheduleAiIfNeeded(room);
  }

  private scheduleAiIfNeeded(room: RoomInfo): void {
    const prev = this.aiTimers.get(room.code);
    if (prev) clearTimeout(prev);

    const state = room.matchState;
    if (!state || room.status !== 'playing' || state.phase === 'finished') return;
    const active = state.players[state.currentTurnSeat];
    if (active.kind !== 'ai') return;

    const timer = setTimeout(() => {
      if (!room.matchState || room.status !== 'playing') return;
      const cur = room.matchState;
      const aiSeat = cur.currentTurnSeat;
      if (cur.players[aiSeat].kind !== 'ai') return;

      if (cur.phase === 'waiting_roll') {
        const diceValue = crypto.randomInt(1, 7);
        const rolled = applyRoll(cur, aiSeat, diceValue);
        room.matchState = rolled;
        this.broadcastRoom(room, { type: 'match:rolled', diceValue, seatIndex: aiSeat, state: rolled });

        if (rolled.phase === 'no_moves') {
          setTimeout(() => {
            if (room.matchState?.phase === 'no_moves') {
              room.matchState = advanceTurnAfterNoMoves(room.matchState);
              this.broadcastRoom(room, { type: 'match:state', state: room.matchState });
              this.scheduleAiIfNeeded(room);
            }
          }, 1100);
        } else {
          this.scheduleAiIfNeeded(room);
        }
      } else if (cur.phase === 'selecting_token') {
        const chosenToken = chooseAIMove(cur, aiSeat, cur.players[aiSeat].aiDifficulty ?? 'hard');
        const moved = applyMove(cur, aiSeat, chosenToken);
        room.matchState = moved;
        if (moved.phase === 'finished') room.status = 'finished';
        this.broadcastRoom(room, { type: 'match:moved', seatIndex: aiSeat, tokenIndex: chosenToken, state: moved });
        this.scheduleAiIfNeeded(room);
      }
    }, 950);

    this.aiTimers.set(room.code, timer);
  }
}
