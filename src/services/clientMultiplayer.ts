import type { GameMode, MatchState } from '../game/types';

export interface OnlineRoomSnapshot {
  code: string;
  mode: GameMode;
  hostClientId: string;
  maxPlayers: 2 | 3 | 4;
  seats: Array<{
    clientId: string;
    name: string;
    avatar: string;
    ready: boolean;
    connected: boolean;
  }>;
  status: 'lobby' | 'playing' | 'finished';
  matchState: MatchState | null;
}

export interface MultiplayerEvents {
  onConnectionChange: (connected: boolean) => void;
  onRoomUpdate: (room: OnlineRoomSnapshot) => void;
  onMatchRolled: (diceValue: number, seatIndex: number, state: MatchState) => void;
  onMatchMoved: (seatIndex: number, tokenIndex: number, state: MatchState) => void;
  onMatchState: (state: MatchState) => void;
  onError: (message: string) => void;
}

export class ClientMultiplayer {
  private ws: WebSocket | null = null;
  private clientId: string;
  private events: MultiplayerEvents;
  private activeRoomCode: string | null = null;
  private reconnectTimer: number | null = null;
  private intentionallyClosed = false;

  constructor(clientId: string, events: MultiplayerEvents) {
    this.clientId = clientId;
    this.events = events;
  }

  public connect(rejoinRoomCode?: string | null): void {
    this.intentionallyClosed = false;
    if (rejoinRoomCode) {
      this.activeRoomCode = rejoinRoomCode;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.events.onConnectionChange(true);
      this.send({
        type: 'auth:identify',
        clientId: this.clientId,
        roomCode: this.activeRoomCode,
      });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        const type = String(msg.type ?? '');
        if (type === 'room:joined' || type === 'room:update' || type === 'room:started') {
          const room = msg.room as OnlineRoomSnapshot;
          this.activeRoomCode = room.code;
          this.events.onRoomUpdate(room);
        } else if (type === 'match:rolled') {
          this.events.onMatchRolled(Number(msg.diceValue), Number(msg.seatIndex), msg.state as MatchState);
        } else if (type === 'match:moved') {
          this.events.onMatchMoved(Number(msg.seatIndex), Number(msg.tokenIndex), msg.state as MatchState);
        } else if (type === 'match:state') {
          this.events.onMatchState(msg.state as MatchState);
        } else if (type === 'error') {
          this.events.onError(String(msg.message ?? 'Multiplayer error'));
        }
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.events.onConnectionChange(false);
      this.ws = null;
      if (!this.intentionallyClosed && this.activeRoomCode) {
        this.reconnectTimer = window.setTimeout(() => {
          this.connect(this.activeRoomCode);
        }, 2000);
      }
    };
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public createPrivateRoom(name: string, avatar: string, maxPlayers: 2 | 3 | 4): void {
    this.connect();
    const waitAndSend = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'room:create', mode: 'online_private', name, avatar, maxPlayers });
      } else {
        window.setTimeout(waitAndSend, 80);
      }
    };
    waitAndSend();
  }

  public joinPrivateRoom(code: string, name: string, avatar: string): void {
    this.connect();
    const waitAndSend = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'room:join', code, name, avatar });
      } else {
        window.setTimeout(waitAndSend, 80);
      }
    };
    waitAndSend();
  }

  public joinMatchmaking(mode: 'online_quick' | 'online_ranked', name: string, avatar: string, maxPlayers: 2 | 3 | 4): void {
    this.connect();
    const waitAndSend = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'matchmaking:join', mode, name, avatar, maxPlayers });
      } else {
        window.setTimeout(waitAndSend, 80);
      }
    };
    waitAndSend();
  }

  public startRoomMatch(fillWithAi = true): void {
    this.send({ type: 'room:start', fillWithAi });
  }

  public leaveRoom(): void {
    this.activeRoomCode = null;
    this.send({ type: 'room:leave' });
  }

  public sendRoll(): void {
    this.send({ type: 'match:roll' });
  }

  public sendMove(tokenIndex: number): void {
    this.send({ type: 'match:move', tokenIndex });
  }

  public dispose(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }
}
