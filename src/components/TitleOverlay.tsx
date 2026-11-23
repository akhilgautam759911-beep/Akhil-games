import React from 'react';
import {
  Award,
  Bot,
  Coins,
  Crown,
  Gift,
  Globe,
  HelpCircle,
  KeyRound,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { xpForLevel } from '../game/shopCatalog';
import type { AIDifficulty, GameMode, PlayerProfile } from '../game/types';
import { AvatarCrest, Ludo3DLogo } from './SvgIcons';

export interface LobbyConfig {
  mode: GameMode;
  playerCount: 2 | 3 | 4;
  humanCount: number; // used in pass_and_play or 2v2
  teamMode: boolean;
  aiDifficulty: AIDifficulty;
  roomCodeInput: string;
}

interface TitleOverlayProps {
  profile: PlayerProfile;
  config: LobbyConfig;
  onChangeConfig: (next: Partial<LobbyConfig>) => void;
  onStartPrimary: () => void;
  onJoinPrivateCode: () => void;
  onOpenModal: (modal: 'shop' | 'rewards' | 'leaderboard' | 'profile' | 'settings' | 'howto') => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  profile,
  config,
  onChangeConfig,
  onStartPrimary,
  onJoinPrivateCode,
  onOpenModal,
}) => {
  const levelCap = xpForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / levelCap) * 100));
  const today = new Date().toISOString().slice(0, 10);
  const canClaimDaily = profile.lastDailyClaimDate !== today;

  const modes: Array<{ id: GameMode; label: string; icon: React.ReactNode }> = [
    { id: 'vs_ai', label: 'Vs Computer', icon: <Bot className="w-4 h-4" /> },
    { id: 'pass_and_play', label: 'Pass & Play', icon: <Users className="w-4 h-4" /> },
    { id: 'online_quick', label: 'Quick Match', icon: <Globe className="w-4 h-4" /> },
    { id: 'online_ranked', label: 'Ranked', icon: <Crown className="w-4 h-4" /> },
    { id: 'online_private', label: 'Private Room', icon: <KeyRound className="w-4 h-4" /> },
  ];

  const primaryCtaLabel =
    config.mode === 'online_private'
      ? 'Create Private Room'
      : config.mode === 'online_quick'
        ? 'Find Quick Match'
        : config.mode === 'online_ranked'
          ? 'Enter Ranked Match'
          : 'Play Now';

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-8"
      aria-label="Main Menu"
    >
      {/* Top Row: Profile Bar (Left) & Compact Utility Row (Right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenModal('profile')}
          className="pointer-events-auto flex items-center gap-3 rounded-xl px-3.5 py-2 border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853]/70 transition-colors text-left"
          aria-label="Open player profile"
        >
          <AvatarCrest avatar={profile.avatar} className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#f5efe6] truncate max-w-[130px]">{profile.username}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#e5a91a] tabular-nums">
                Lv.{profile.level}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-[#2b231b] overflow-hidden">
                <div className="h-full bg-[#d4a853]" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[11px] text-[#cbbba6] tabular-nums">
                {profile.wins}W / {profile.matchesPlayed}M · {profile.elo} ELO
              </span>
            </div>
          </div>
          <div className="pl-2 border-l border-[#d4a853]/25 flex items-center gap-1.5 text-[#facc15] font-bold text-sm tabular-nums">
            <Coins className="w-4 h-4" />
            <span>{profile.coins.toLocaleString()}</span>
          </div>
        </button>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenModal('rewards')}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853] text-[#f5efe6] transition-colors"
            aria-label="Daily Rewards and Missions"
          >
            <Gift className="w-4 h-4 text-[#facc15]" />
            <span className="hidden sm:inline">Rewards</span>
            {canClaimDaily && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded bg-[#d9383a] text-[10px] font-bold text-white">1</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('shop')}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853] text-[#f5efe6] transition-colors"
            aria-label="Game Shop"
          >
            <ShoppingBag className="w-4 h-4 text-[#e5a91a]" />
            <span className="hidden sm:inline">Shop</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('leaderboard')}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853] text-[#f5efe6] transition-colors"
            aria-label="Leaderboards"
          >
            <Award className="w-4 h-4 text-[#60a5fa]" />
            <span className="hidden sm:inline">Ranks</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('howto')}
            className="flex items-center justify-center rounded-xl p-2 border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853] text-[#f5efe6] transition-colors"
            aria-label="How to Play"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('settings')}
            className="flex items-center justify-center rounded-xl p-2 border border-[#d4a853]/35 bg-[#16120e]/92 hover:border-[#d4a853] text-[#f5efe6] transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Left-Third Command Panel over calm negative space; 3D Board shines on the right */}
      <div className="my-auto w-full max-w-[380px] pointer-events-auto rounded-2xl border border-[#d4a853]/40 bg-[#14100c]/92 p-5 shadow-2xl">
        <Ludo3DLogo className="w-56 h-auto mb-4" />

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1.5 mb-4" role="tablist" aria-label="Game modes">
          {modes.map((m) => {
            const active = config.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeConfig({ mode: m.id })}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold border transition-colors ${
                  m.id === 'online_private' ? 'col-span-2 justify-center' : ''
                } ${
                  active
                    ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                    : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6] hover:border-[#786144]'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Player Count / Team Config */}
        <div className="space-y-3 mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#a99882] mb-1.5">
              Table Seats
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([2, 3, 4] as const).map((cnt) => {
                const active = config.playerCount === cnt && !config.teamMode;
                return (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onChangeConfig({ playerCount: cnt, teamMode: false })}
                    className={`rounded-lg py-1.5 text-xs font-bold border tabular-nums ${
                      active
                        ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                        : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6]'
                    }`}
                  >
                    {cnt}P
                  </button>
                );
              })}
              <button
                type="button"
                disabled={config.mode === 'online_private' || config.mode === 'online_quick' || config.mode === 'online_ranked'}
                onClick={() => onChangeConfig({ playerCount: 4, teamMode: true })}
                className={`rounded-lg py-1.5 text-xs font-bold border disabled:opacity-40 ${
                  config.teamMode
                    ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                    : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6]'
                }`}
              >
                2v2
              </button>
            </div>
          </div>

          {config.mode === 'vs_ai' && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#a99882] mb-1.5">
                AI Difficulty
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => {
                  const active = config.aiDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => onChangeConfig({ aiDifficulty: diff })}
                      className={`rounded-lg py-1.5 text-[11px] font-bold uppercase border ${
                        active
                          ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                          : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6]'
                      }`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {config.mode === 'online_private' && (
            <div>
              <label htmlFor="room-code-input" className="block text-[11px] font-bold uppercase tracking-wider text-[#a99882] mb-1.5">
                Join Existing Room Code
              </label>
              <div className="flex gap-2">
                <input
                  id="room-code-input"
                  type="text"
                  maxLength={6}
                  placeholder="E.g. A7K9P2"
                  value={config.roomCodeInput}
                  onChange={(e) => onChangeConfig({ roomCodeInput: e.target.value.toUpperCase() })}
                  className="flex-1 rounded-lg border border-[#4a3b2c] bg-[#1b1611] px-3 py-2 text-sm font-bold tracking-widest uppercase text-[#f5efe6] placeholder:text-[#6f6152] focus:outline-none focus:border-[#e5a91a]"
                />
                <button
                  type="button"
                  onClick={onJoinPrivateCode}
                  disabled={config.roomCodeInput.trim().length < 4}
                  className="rounded-lg px-3.5 py-2 text-xs font-bold bg-[#2c2113] border border-[#d4a853]/60 text-[#fde68a] hover:bg-[#3b2c19] disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStartPrimary}
          className="w-full rounded-xl py-3.5 px-5 font-display text-base font-bold tracking-wider uppercase bg-[#d4a853] hover:bg-[#e3ba66] active:scale-[0.99] text-[#14100c] shadow-lg transition-all cursor-pointer"
        >
          {primaryCtaLabel}
        </button>
      </div>

      {/* Single flat borderless control-hint line */}
      <div className="text-center sm:text-left text-xs font-semibold tracking-wide text-[#f5efe6] hud-stroke">
        Click Dice or Space to Roll · Click Glowing Token to Move · 1–4 Camera · Esc Pause
      </div>
    </div>
  );
};
