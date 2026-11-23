import React from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { COLOR_PALETTE } from '../game/boardLayout';
import type { CameraMode, MatchState, PlayerSlot } from '../game/types';
import { AvatarCrest, DiceFaceSvg } from './SvgIcons';

interface GameHudProps {
  match: MatchState;
  localClientId: string;
  cameraMode: CameraMode;
  muted: boolean;
  isAnimating: boolean;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onRollDice: () => void;
  onSelectCamera: (mode: CameraMode) => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

const CornerPlaque: React.FC<{
  player: PlayerSlot;
  isActive: boolean;
  teamMode: boolean;
  className?: string;
}> = ({ player, isActive, teamMode, className = '' }) => {
  const pal = COLOR_PALETTE[player.color];
  return (
    <div
      className={`pointer-events-none flex items-center gap-2 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 border transition-colors ${
        isActive
          ? 'bg-[#1a140e]/95 border-[#e5a91a] shadow-lg'
          : 'bg-[#14100c]/88 border-[#3d3124]'
      } ${className}`}
    >
      <div
        className="w-1.5 sm:w-2 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: pal.primary }}
      />
      <AvatarCrest avatar={player.avatar} className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] sm:text-xs font-bold text-[#f5efe6] truncate max-w-[88px] sm:max-w-[100px]">
            {player.name}
          </span>
          {player.kind === 'ai' && (
            <span className="text-[9px] sm:text-[10px] font-bold uppercase px-1 rounded bg-[#2d241b] text-[#cbbba6]">
              AI
            </span>
          )}
          {teamMode && (
            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-[#e5a91a]">
              T{player.teamIndex + 1}
            </span>
          )}
        </div>
        {/* 4 Token Status Sockets: Hollow (Yard), Active Ring (On Board), Filled (Finished) */}
        <div className="mt-1 flex items-center gap-1.5">
          {player.tokens.map((tok) => {
            const finished = tok.progress === 56;
            const onTrack = tok.progress >= 0 && tok.progress < 56;
            return (
              <span
                key={tok.index}
                title={finished ? 'Finished' : onTrack ? 'On Track' : 'In Yard'}
                className="w-2.5 h-2.5 rounded-full border"
                style={{
                  borderColor: pal.primary,
                  backgroundColor: finished
                    ? pal.primary
                    : onTrack
                      ? pal.light
                      : 'transparent',
                }}
              />
            );
          })}
          {player.captures > 0 && (
            <span className="ml-1 text-[10px] font-bold text-[#facc15] tabular-nums">
              {player.captures}⚔
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const GameHud: React.FC<GameHudProps> = ({
  match,
  localClientId,
  cameraMode,
  muted,
  isAnimating,
  dockCollapsed,
  onToggleDock,
  onRollDice,
  onSelectCamera,
  onToggleMute,
  onOpenPause,
}) => {
  const activePlayer = match.players[match.currentTurnSeat];
  const isMyTurn =
    activePlayer.kind === 'human' ||
    (activePlayer.kind === 'remote' && activePlayer.clientId === localClientId);

  const canRoll = match.phase === 'waiting_roll' && isMyTurn && !isAnimating;
  const turnOwner = activePlayer.name === 'You' ? 'Your Turn' : `${activePlayer.name}'s Turn`;

  const statusPrompt =
    match.phase === 'finished'
      ? match.lastEvent?.message ?? 'Match Complete!'
      : isAnimating
        ? 'Rolling / Moving...'
        : match.phase === 'no_moves'
          ? match.lastEvent?.message ?? 'No legal moves'
          : match.phase === 'selecting_token'
            ? isMyTurn
              ? `Rolled ${match.diceValue} — Click a glowing token`
              : `${activePlayer.name} rolled ${match.diceValue}`
            : isMyTurn
              ? `${turnOwner} — Roll Dice`
              : `${activePlayer.name} is rolling...`;

  const cornerMap: Record<string, string> = {
    red: 'fixed top-4 left-4 z-10',
    green: 'fixed top-4 right-4 z-10',
    yellow: 'fixed bottom-24 right-4 z-10',
    blue: 'fixed bottom-24 left-4 z-10',
  };

  const cameras: Array<{ id: CameraMode; label: string }> = [
    { id: 'top', label: 'Top' },
    { id: 'cinematic', label: 'Angle' },
    { id: 'dice', label: 'Dice' },
    { id: 'follow', label: 'Follow' },
    { id: 'free', label: 'Free' },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none" aria-label="Game HUD">
      {/* Mobile (< sm): Compact 2x2 top grid so bottom plaques never collide with the dock */}
      <div className="sm:hidden fixed top-2.5 left-2.5 right-2.5 z-10 grid grid-cols-2 gap-1.5">
        {match.players.map((p) => (
          <CornerPlaque
            key={`mob-${p.seatIndex}`}
            player={p}
            isActive={p.seatIndex === match.currentTurnSeat && match.phase !== 'finished'}
            teamMode={match.rules.teamMode}
          />
        ))}
      </div>

      {/* Desktop/Tablet (>= sm): 4 Corner Player Plaques */}
      <div className="hidden sm:block">
        {match.players.map((p) => (
          <CornerPlaque
            key={`desk-${p.seatIndex}`}
            player={p}
            isActive={p.seatIndex === match.currentTurnSeat && match.phase !== 'finished'}
            teamMode={match.rules.teamMode}
            className={cornerMap[p.color]}
          />
        ))}
      </div>

      {/* Top-Center Turn Banner (Desktop) */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:flex items-center gap-2 rounded-full px-4 py-1.5 border border-[#d4a853]/35 bg-[#14100c]/92">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: COLOR_PALETTE[activePlayer.color].primary }}
        />
        <span className="text-xs font-semibold text-[#f5efe6] tracking-wide" data-testid="turn-status">
          {statusPrompt}
        </span>
        <span className="text-[11px] font-bold text-[#a99882] tabular-nums pl-2 border-l border-[#3d3124]">
          Turn {match.turnCount}
        </span>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[95vw]">
        <div className="md:hidden mb-1.5 px-3 py-1 rounded-full border border-[#d4a853]/35 bg-[#14100c]/92 text-[11px] font-semibold text-[#f5efe6] whitespace-nowrap">
          {statusPrompt}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleDock();
          }}
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-t-lg px-3 py-0.5 text-[11px] font-semibold border border-b-0 border-[#d4a853]/35 bg-[#16120e]/95 text-[#cbbba6] hover:text-[#fde68a]"
          aria-label={dockCollapsed ? 'Show Controls' : 'Hide Controls'}
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls' : 'Hide'}</span>
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-[#d4a853]/45 bg-[#14100c]/95 px-3.5 py-2.5 shadow-2xl">
            {/* Dice Roll CTA + Live Die Readout */}
            <div className="flex items-center gap-2.5 sm:pr-2.5 sm:border-r sm:border-[#3d3124]">
              <DiceFaceSvg value={match.diceValue} className="w-9 h-9 shrink-0" />
              <button
                type="button"
                data-testid="roll-dice-btn"
                disabled={!canRoll}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRollDice();
                }}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  canRoll
                    ? 'bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c] shadow-md'
                    : 'bg-[#261f18] text-[#7a6b5a] cursor-not-allowed'
                }`}
              >
                {match.phase === 'selecting_token' && isMyTurn ? 'Pick Token' : 'Roll Dice'}
              </button>
            </div>

            {/* Camera Modes */}
            <div className="hidden sm:flex items-center gap-1 pr-2.5 border-r border-[#3d3124]">
              <Camera className="w-3.5 h-3.5 text-[#a99882] mr-1" />
              {cameras.map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectCamera(cam.id);
                  }}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                    cameraMode === cam.id
                      ? 'bg-[#2c2113] text-[#fde68a] border border-[#d4a853]/60'
                      : 'text-[#cbbba6] hover:bg-[#221b14]'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            {/* Utility Icon Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="p-2 rounded-lg border border-[#3d3124] bg-[#1b1611] hover:border-[#d4a853] text-[#f5efe6]"
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {muted ? <VolumeX className="w-4 h-4 text-[#d9383a]" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenPause();
                }}
                className="p-2 rounded-lg border border-[#3d3124] bg-[#1b1611] hover:border-[#d4a853] text-[#f5efe6]"
                aria-label="Pause Game"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
