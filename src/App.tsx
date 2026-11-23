import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import {
  HowToPlayModal,
  LeaderboardModal,
  MultiplayerLobbyModal,
  PauseModal,
  ProfileFriendsModal,
  RewardsModal,
  SettingsModal,
  ShopModal,
  VictoryModal,
} from './components/Modals';
import { TitleOverlay, type LobbyConfig } from './components/TitleOverlay';
import { AudioManager } from './engine/audioManager';
import { LudoSceneController } from './engine/LudoSceneController';
import { chooseAIMove } from './game/aiManager';
import { COLOR_PALETTE, getActiveColorsForCount } from './game/boardLayout';
import {
  advanceTurnAfterNoMoves,
  applyMove,
  applyRoll,
  createInitialMatchState,
  getStepWaypoints,
} from './game/rulesEngine';
import { createDefaultProfile } from './game/shopCatalog';
import type {
  CameraMode,
  GameSettings,
  MatchState,
  PlayerConfigInput,
  PlayerProfile,
} from './game/types';
import { ClientMultiplayer, type OnlineRoomSnapshot } from './services/clientMultiplayer';
import {
  addFriendApi,
  claimDailyRewardApi,
  claimMissionApi,
  fetchLeaderboardApi,
  fetchProfile,
  getOrCreateClientId,
  loadSettings,
  recordMatchResultApi,
  removeFriendApi,
  saveSettings,
  shopPurchaseOrEquipApi,
  updateProfileIdentityApi,
} from './services/storage';

type ShellState = 'title' | 'playing' | 'paused' | 'gameover';
type ActiveModal =
  | null
  | 'shop'
  | 'rewards'
  | 'leaderboard'
  | 'profile'
  | 'settings'
  | 'howto';

export default function App() {
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<LudoSceneController | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const mpRef = useRef<ClientMultiplayer | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [profile, setProfile] = useState<PlayerProfile>(() => createDefaultProfile(clientIdRef.current));
  const [shellState, setShellState] = useState<ShellState>('title');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const [lobbyConfig, setLobbyConfig] = useState<LobbyConfig>({
    mode: 'vs_ai',
    playerCount: 4,
    humanCount: 1,
    teamMode: false,
    aiDifficulty: 'medium',
    roomCodeInput: '',
  });

  const [match, setMatch] = useState<MatchState | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [victoryRewards, setVictoryRewards] = useState<{ coinsEarned: number; xpEarned: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ id: string; username: string; avatar: string; level: number; elo: number; wins: number; matchesPlayed: number }>
  >([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Refs for stable access inside Three.js & WebSocket callbacks without re-mounting canvas
  const matchRef = useRef<MatchState | null>(null);
  const shellStateRef = useRef<ShellState>('title');
  const isAnimatingRef = useRef<boolean>(false);
  const settingsRef = useRef<GameSettings>(settings);
  const profileRef = useRef<PlayerProfile>(profile);
  const sixesThisMatchRef = useRef<number>(0);
  const aiTimerRef = useRef<number | null>(null);

  matchRef.current = match;
  shellStateRef.current = shellState;
  isAnimatingRef.current = isAnimating;
  settingsRef.current = settings;
  profileRef.current = profile;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Mirror game state machine to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = shellState;
  }, [shellState]);

  const finishMatchAndRecord = useCallback(async (finishedState: MatchState) => {
    setShellState('gameover');
    const primaryWinner = finishedState.players[finishedState.winnerSeats[0] ?? 0];
    sceneRef.current?.triggerVictoryCelebration(primaryWinner.color);

    const localPlayer =
      finishedState.players.find((p) => p.clientId === clientIdRef.current) ?? finishedState.players[0];
    const localWon = finishedState.winnerSeats.includes(localPlayer.seatIndex);

    try {
      const res = await recordMatchResultApi(clientIdRef.current, {
        mode: finishedState.mode,
        won: localWon,
        playersCount: finishedState.players.length,
        captures: localPlayer.captures,
        sixesRolled: sixesThisMatchRef.current,
        turns: finishedState.turnCount,
      });
      setProfile(res.profile);
      setVictoryRewards({ coinsEarned: res.coinsEarned, xpEarned: res.xpEarned });
    } catch {
      setVictoryRewards({ coinsEarned: localWon ? 180 : 55, xpEarned: localWon ? 120 : 45 });
    }
  }, []);

  // Execute token hop animation and commit resulting state
  const runMoveTransition = useCallback(
    (prevState: MatchState, nextState: MatchState, seatIndex: number, tokenIndex: number) => {
      const movedPlayer = prevState.players[seatIndex];
      const chosen = prevState.legalMoves.find((m) => m.tokenIndex === tokenIndex);
      if (!chosen || !sceneRef.current) {
        setMatch(nextState);
        sceneRef.current?.syncMatchState(nextState);
        if (nextState.phase === 'finished') finishMatchAndRecord(nextState);
        return;
      }

      setIsAnimating(true);
      isAnimatingRef.current = true;
      const waypoints = getStepWaypoints(movedPlayer.color, tokenIndex, chosen.fromProgress, chosen.toProgress);
      sceneRef.current.animateTokenMove(
        seatIndex,
        tokenIndex,
        waypoints,
        chosen.captures,
        chosen.isFinish,
        () => {
          setIsAnimating(false);
          isAnimatingRef.current = false;
          setMatch(nextState);
          sceneRef.current?.syncMatchState(nextState);
          if (nextState.phase === 'finished') {
            finishMatchAndRecord(nextState);
          } else {
            const nextPlayer = nextState.players[nextState.currentTurnSeat];
            if (nextPlayer.kind === 'human') {
              audioRef.current?.playTurnNotify();
            }
          }
        },
      );
    },
    [finishMatchAndRecord],
  );

  // Offline local roll handler (Human or AI)
  const executeLocalRoll = useCallback(
    (forcedRoll?: number) => {
      const cur = matchRef.current;
      if (!cur || cur.phase !== 'waiting_roll' || isAnimatingRef.current || shellStateRef.current !== 'playing') return;

      audioRef.current?.unlock();
      const seat = cur.currentTurnSeat;
      const player = cur.players[seat];
      const diceVal = forcedRoll ?? Math.floor(Math.random() * 6) + 1;
      if (diceVal === 6 && player.kind === 'human') {
        sixesThisMatchRef.current += 1;
      }

      const rolled = applyRoll(cur, seat, diceVal);
      setIsAnimating(true);
      isAnimatingRef.current = true;

      sceneRef.current?.animateDiceRoll(diceVal, player.color, () => {
        setIsAnimating(false);
        isAnimatingRef.current = false;
        setMatch(rolled);
        sceneRef.current?.syncMatchState(rolled);

        if (rolled.phase === 'no_moves') {
          window.setTimeout(() => {
            const latest = matchRef.current;
            if (latest && latest.phase === 'no_moves' && shellStateRef.current === 'playing') {
              const advanced = advanceTurnAfterNoMoves(latest);
              setMatch(advanced);
              sceneRef.current?.syncMatchState(advanced);
            }
          }, 950);
        }
      });
    },
    [],
  );

  // Offline local move handler (Human or AI)
  const executeLocalMove = useCallback(
    (seatIndex: number, tokenIndex: number) => {
      const cur = matchRef.current;
      if (!cur || cur.phase !== 'selecting_token' || isAnimatingRef.current || shellStateRef.current !== 'playing') return;
      if (cur.currentTurnSeat !== seatIndex) return;

      try {
        const nextState = applyMove(cur, seatIndex, tokenIndex);
        runMoveTransition(cur, nextState, seatIndex, tokenIndex);
      } catch {
        // ignore illegal click
      }
    },
    [runMoveTransition],
  );

  const handleRollTrigger = useCallback(() => {
    const cur = matchRef.current;
    if (!cur || cur.phase !== 'waiting_roll' || isAnimatingRef.current) return;
    const active = cur.players[cur.currentTurnSeat];

    if (cur.mode === 'online_quick' || cur.mode === 'online_ranked' || cur.mode === 'online_private') {
      if (active.clientId !== clientIdRef.current) return;
      mpRef.current?.sendRoll();
      return;
    }

    if (active.kind === 'human') {
      executeLocalRoll();
    }
  }, [executeLocalRoll]);

  const handleTokenTrigger = useCallback(
    (seatIndex: number, tokenIndex: number) => {
      const cur = matchRef.current;
      if (!cur || cur.phase !== 'selecting_token' || isAnimatingRef.current) return;
      if (cur.currentTurnSeat !== seatIndex) return;
      const active = cur.players[seatIndex];

      if (cur.mode === 'online_quick' || cur.mode === 'online_ranked' || cur.mode === 'online_private') {
        if (active.clientId !== clientIdRef.current) return;
        mpRef.current?.sendMove(tokenIndex);
        return;
      }

      if (active.kind === 'human') {
        executeLocalMove(seatIndex, tokenIndex);
      }
    },
    [executeLocalMove],
  );

  // Offline AI turn automation loop
  useEffect(() => {
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (shellState !== 'playing' || !match || isAnimating) return;
    if (match.mode === 'online_quick' || match.mode === 'online_ranked' || match.mode === 'online_private') return;

    const active = match.players[match.currentTurnSeat];
    if (!active || active.kind !== 'ai') return;

    if (match.phase === 'waiting_roll') {
      aiTimerRef.current = window.setTimeout(() => {
        executeLocalRoll();
      }, 650);
    } else if (match.phase === 'selecting_token') {
      aiTimerRef.current = window.setTimeout(() => {
        const latest = matchRef.current;
        if (!latest || latest.phase !== 'selecting_token') return;
        const chosenToken = chooseAIMove(latest, latest.currentTurnSeat, active.aiDifficulty ?? 'medium');
        executeLocalMove(latest.currentTurnSeat, chosenToken);
      }, 550);
    }

    return () => {
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [shellState, match, isAnimating, executeLocalRoll, executeLocalMove]);

  // Auto-pass single legal move if enabled in settings
  useEffect(() => {
    if (!settings.autoPassSingleMove) return;
    if (shellState !== 'playing' || !match || isAnimating) return;
    if (match.phase !== 'selecting_token') return;
    const active = match.players[match.currentTurnSeat];
    if (active.kind === 'human' && match.legalMoves.length === 1) {
      const t = window.setTimeout(() => {
        handleTokenTrigger(match.currentTurnSeat, match.legalMoves[0].tokenIndex);
      }, 320);
      return () => window.clearTimeout(t);
    }
  }, [settings.autoPassSingleMove, shellState, match, isAnimating, handleTokenTrigger]);

  // Mount Three.js scene ONCE + Audio + Multiplayer WebSocket + Initial Profile Load
  useEffect(() => {
    const audio = new AudioManager();
    audio.updateSettings(settingsRef.current.audio);
    audioRef.current = audio;

    if (canvasMountRef.current) {
      const ctrl = new LudoSceneController(
        canvasMountRef.current,
        audio,
        {
          onDiceClicked: () => handleRollTrigger(),
          onTokenClicked: (seat, tok) => handleTokenTrigger(seat, tok),
          onCameraUserInteracted: () => {
            setSettings((prev) => ({ ...prev, cameraMode: 'free' }));
          },
        },
        {
          board: profileRef.current.equippedBoard,
          dice: profileRef.current.equippedDice,
          token: profileRef.current.equippedToken,
          graphics: settingsRef.current.graphics,
        },
      );
      ctrl.setTitleMode(true);
      sceneRef.current = ctrl;
    }

    const mp = new ClientMultiplayer(clientIdRef.current, {
      onConnectionChange: () => {},
      onRoomUpdate: (room) => {
        setOnlineRoom(room);
        if (room.status === 'playing' && room.matchState) {
          setOnlineRoom(null);
          setMatch(room.matchState);
          setShellState('playing');
          sceneRef.current?.setTitleMode(false);
          sceneRef.current?.syncMatchState(room.matchState, true);
        }
      },
      onMatchRolled: (diceValue, seatIndex, state) => {
        const rollerColor = state.players[seatIndex]?.color ?? 'red';
        if (diceValue === 6 && state.players[seatIndex]?.clientId === clientIdRef.current) {
          sixesThisMatchRef.current += 1;
        }
        setIsAnimating(true);
        isAnimatingRef.current = true;
        sceneRef.current?.animateDiceRoll(diceValue, rollerColor, () => {
          setIsAnimating(false);
          isAnimatingRef.current = false;
          setMatch(state);
          sceneRef.current?.syncMatchState(state);
        });
      },
      onMatchMoved: (seatIndex, tokenIndex, state) => {
        const prev = matchRef.current;
        if (prev) {
          runMoveTransition(prev, state, seatIndex, tokenIndex);
        } else {
          setMatch(state);
          sceneRef.current?.syncMatchState(state);
        }
      },
      onMatchState: (state) => {
        setMatch(state);
        sceneRef.current?.syncMatchState(state);
        if (state.phase === 'finished') {
          finishMatchAndRecord(state);
        }
      },
      onError: (msg) => showToast(msg),
    });
    mpRef.current = mp;

    fetchProfile(clientIdRef.current).then((prof) => {
      setProfile(prof);
      sceneRef.current?.setCosmetics(prof.equippedBoard, prof.equippedDice, prof.equippedToken);
    });

    // Check URL flags: ?autostart=1 or ?room=CODE
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const colors = getActiveColorsForCount(4);
      const players: PlayerConfigInput[] = colors.map((color, idx) => ({
        color,
        name: idx === 0 ? 'You' : `${COLOR_PALETTE[color].label} AI`,
        avatar: idx === 0 ? 'crown' : 'knight',
        kind: idx === 0 ? 'human' : 'ai',
        aiDifficulty: 'medium',
      }));
      const initial = createInitialMatchState({
        matchId: `auto-${Date.now()}`,
        mode: 'vs_ai',
        players,
        rules: settingsRef.current.rules,
      });
      sixesThisMatchRef.current = 0;
      setMatch(initial);
      setShellState('playing');
      sceneRef.current?.setTitleMode(false);
      sceneRef.current?.syncMatchState(initial, true);
    } else if (params.get('room')) {
      const code = params.get('room')!.toUpperCase();
      setLobbyConfig((prev) => ({ ...prev, mode: 'online_private', roomCodeInput: code }));
      mp.joinPrivateRoom(code, profileRef.current.username, profileRef.current.avatar);
    }

    return () => {
      mp.dispose();
      sceneRef.current?.dispose();
      audio.dispose();
    };
  }, [finishMatchAndRecord, handleRollTrigger, handleTokenTrigger, runMoveTransition, showToast]);

  // Sync audio & graphics settings changes
  useEffect(() => {
    saveSettings(settings);
    audioRef.current?.updateSettings(settings.audio);
    sceneRef.current?.applyGraphicsPreset(settings.graphics);
  }, [settings]);

  // Sync equipped cosmetics to 3D board, dice, and tokens
  useEffect(() => {
    sceneRef.current?.setCosmetics(profile.equippedBoard, profile.equippedDice, profile.equippedToken);
  }, [profile.equippedBoard, profile.equippedDice, profile.equippedToken]);

  const startLocalMatch = useCallback(
    (cfg: LobbyConfig = lobbyConfig) => {
      audioRef.current?.unlock();
      audioRef.current?.playClick();
      audioRef.current?.startMusic();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const count = cfg.teamMode ? 4 : cfg.playerCount;
      const colors = getActiveColorsForCount(count);
      const players: PlayerConfigInput[] = colors.map((color, idx) => {
        if (cfg.mode === 'pass_and_play') {
          return {
            color,
            name: idx === 0 ? profile.username : `Player ${idx + 1}`,
            avatar: idx === 0 ? profile.avatar : ['knight', 'phoenix', 'diamond'][idx % 3],
            kind: 'human',
          };
        }
        // vs_ai (1 human vs AI, or 2 humans vs 2 AI in teamMode)
        const isHuman = idx === 0 || (cfg.teamMode && idx === 2 && cfg.humanCount >= 2);
        return {
          color,
          name: isHuman ? (idx === 0 ? profile.username : 'Partner') : `${COLOR_PALETTE[color].label} AI`,
          avatar: isHuman ? profile.avatar : ['knight', 'phoenix', 'diamond'][idx % 3],
          kind: isHuman ? 'human' : 'ai',
          aiDifficulty: cfg.aiDifficulty,
        };
      });

      const initial = createInitialMatchState({
        matchId: `local-${Date.now()}`,
        mode: cfg.mode,
        players,
        rules: { ...settings.rules, teamMode: cfg.teamMode },
      });

      sixesThisMatchRef.current = 0;
      setVictoryRewards(null);
      setActiveModal(null);
      setMatch(initial);
      setShellState('playing');
      sceneRef.current?.setTitleMode(false);
      sceneRef.current?.syncMatchState(initial, true);
    },
    [lobbyConfig, profile.avatar, profile.username, settings.rules],
  );

  const handleStartPrimary = useCallback(() => {
    if (lobbyConfig.mode === 'online_private') {
      mpRef.current?.createPrivateRoom(profile.username, profile.avatar, lobbyConfig.playerCount);
      return;
    }
    if (lobbyConfig.mode === 'online_quick' || lobbyConfig.mode === 'online_ranked') {
      mpRef.current?.joinMatchmaking(lobbyConfig.mode, profile.username, profile.avatar, lobbyConfig.playerCount);
      return;
    }
    startLocalMatch(lobbyConfig);
  }, [lobbyConfig, profile.avatar, profile.username, startLocalMatch]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Escape') {
        if (activeModal) {
          setActiveModal(null);
          return;
        }
        if (shellState === 'playing') {
          setShellState('paused');
        } else if (shellState === 'paused') {
          setShellState('playing');
        }
        return;
      }

      if (shellState === 'title' && !activeModal && !onlineRoom && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartPrimary();
        return;
      }

      if (shellState === 'playing' && !activeModal) {
        if (e.code === 'Space' || e.code === 'KeyR') {
          e.preventDefault();
          handleRollTrigger();
        } else if (e.code === 'KeyP') {
          setShellState('paused');
        } else if (e.code === 'KeyM') {
          setSettings((prev) => ({ ...prev, audio: { ...prev.audio, muted: !prev.audio.muted } }));
        } else if (e.code === 'KeyH') {
          setDockCollapsed((prev) => !prev);
        } else if (e.code === 'Digit1') {
          setSettings((prev) => ({ ...prev, cameraMode: 'top' }));
          sceneRef.current?.updateCameraPreset('top');
        } else if (e.code === 'Digit2') {
          setSettings((prev) => ({ ...prev, cameraMode: 'cinematic' }));
          sceneRef.current?.updateCameraPreset('cinematic');
        } else if (e.code === 'Digit3') {
          setSettings((prev) => ({ ...prev, cameraMode: 'dice' }));
          sceneRef.current?.updateCameraPreset('dice');
        } else if (e.code === 'Digit4') {
          setSettings((prev) => ({ ...prev, cameraMode: 'follow' }));
          sceneRef.current?.updateCameraPreset('follow');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, handleRollTrigger, handleStartPrimary, onlineRoom, shellState]);

  const handleOpenModal = useCallback(async (modal: ActiveModal) => {
    audioRef.current?.playClick();
    if (modal === 'leaderboard') {
      try {
        const res = await fetchLeaderboardApi();
        setLeaderboard(res.entries);
      } catch {
        setLeaderboard([]);
      }
    }
    setActiveModal(modal);
  }, []);

  const exitToTitle = useCallback(() => {
    mpRef.current?.leaveRoom();
    setOnlineRoom(null);
    setMatch(null);
    setShellState('title');
    setActiveModal(null);
    sceneRef.current?.setTitleMode(true);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0e0c0a]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="ludo-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2 border border-[#d4a853]/60 bg-[#1a140e] text-xs font-bold text-[#fde68a] shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* Title Screen */}
      {shellState === 'title' && (
        <TitleOverlay
          profile={profile}
          config={lobbyConfig}
          onChangeConfig={(partial) => setLobbyConfig((prev) => ({ ...prev, ...partial }))}
          onStartPrimary={handleStartPrimary}
          onJoinPrivateCode={() =>
            mpRef.current?.joinPrivateRoom(lobbyConfig.roomCodeInput, profile.username, profile.avatar)
          }
          onOpenModal={(m) => handleOpenModal(m)}
        />
      )}

      {/* Active Gameplay HUD */}
      {(shellState === 'playing' || shellState === 'paused' || shellState === 'gameover') && match && (
        <GameHud
          match={match}
          localClientId={clientIdRef.current}
          cameraMode={settings.cameraMode}
          muted={settings.audio.muted}
          isAnimating={isAnimating}
          dockCollapsed={dockCollapsed}
          onToggleDock={() => setDockCollapsed((p) => !p)}
          onRollDice={handleRollTrigger}
          onSelectCamera={(mode: CameraMode) => {
            setSettings((prev) => ({ ...prev, cameraMode: mode }));
            sceneRef.current?.updateCameraPreset(mode);
          }}
          onToggleMute={() =>
            setSettings((prev) => ({ ...prev, audio: { ...prev.audio, muted: !prev.audio.muted } }))
          }
          onOpenPause={() => setShellState('paused')}
        />
      )}

      {/* Online Multiplayer Lobby Modal */}
      {onlineRoom && onlineRoom.status === 'lobby' && (
        <MultiplayerLobbyModal
          room={onlineRoom}
          localClientId={clientIdRef.current}
          onStartMatch={(fill) => mpRef.current?.startRoomMatch(fill)}
          onLeave={() => {
            mpRef.current?.leaveRoom();
            setOnlineRoom(null);
          }}
        />
      )}

      {/* Pause Modal */}
      {shellState === 'paused' && !activeModal && (
        <PauseModal
          onResume={() => setShellState('playing')}
          onRestart={() => startLocalMatch(lobbyConfig)}
          onOpenSettings={() => setActiveModal('settings')}
          onExitToTitle={exitToTitle}
        />
      )}

      {/* Victory Modal */}
      {shellState === 'gameover' && match && (
        <VictoryModal
          match={match}
          rewards={victoryRewards}
          onPlayAgain={() => {
            if (match.mode === 'online_private' || match.mode === 'online_quick' || match.mode === 'online_ranked') {
              exitToTitle();
            } else {
              startLocalMatch(lobbyConfig);
            }
          }}
          onMainMenu={exitToTitle}
        />
      )}

      {/* Meta & Progression Modals */}
      {activeModal === 'shop' && (
        <ShopModal
          profile={profile}
          onBuyOrEquip={async (itemId) => {
            const res = await shopPurchaseOrEquipApi(clientIdRef.current, itemId);
            if (!res.ok) throw new Error(res.error ?? 'Purchase failed');
            setProfile(res.profile);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'rewards' && (
        <RewardsModal
          profile={profile}
          onClaimDaily={async () => {
            const res = await claimDailyRewardApi(clientIdRef.current);
            if (res.ok) {
              setProfile(res.profile);
              showToast(`Claimed Day ${res.reward?.day}: +${res.reward?.coins} Coins!`);
            } else {
              showToast(res.error ?? 'Already claimed');
            }
          }}
          onClaimMission={async (missionId) => {
            const res = await claimMissionApi(clientIdRef.current, missionId);
            if (res.ok) setProfile(res.profile);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'leaderboard' && (
        <LeaderboardModal
          entries={leaderboard}
          currentUserId={profile.id}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'profile' && (
        <ProfileFriendsModal
          profile={profile}
          onUpdateIdentity={async (updates) => {
            const updated = await updateProfileIdentityApi(clientIdRef.current, updates);
            setProfile(updated);
          }}
          onAddFriend={async (username) => {
            const res = await addFriendApi(clientIdRef.current, username);
            if (res.ok) setProfile(res.profile);
            else showToast(res.error ?? 'Could not add friend');
          }}
          onRemoveFriend={async (friendId) => {
            const updated = await removeFriendApi(clientIdRef.current, friendId);
            setProfile(updated);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'howto' && <HowToPlayModal onClose={() => setActiveModal(null)} />}
    </div>
  );
}
