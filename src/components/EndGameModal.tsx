import React from 'react';
import { RotateCcw, Play, Trophy, ShieldAlert, Award, Zap } from 'lucide-react';
import { GameState, PlayerStats } from '../types/game';
import { sound } from '../audio/SoundSynth';

interface EndGameModalProps {
  state: GameState;
  stats: PlayerStats;
  onResume: () => void;
  onRestart: () => void;
  onOpenConsole: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  state,
  stats,
  onResume,
  onRestart,
  onOpenConsole,
}) => {
  if (state !== 'PAUSED' && state !== 'GAME_OVER' && state !== 'VICTORY') {
    return null;
  }

  const isPaused = state === 'PAUSED';
  const isVictory = state === 'VICTORY';
  const isGameOver = state === 'GAME_OVER';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <div className="bg-[#07090e] border-2 border-[#dfb15b] rounded-lg max-w-md w-full p-6 text-center shadow-[0_0_35px_rgba(223,177,91,0.3)] font-mono-custom">
        {/* State Icon */}
        <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center bg-[#dfb15b]/10 border border-[#dfb15b]/40">
          {isPaused && <Play className="w-7 h-7 text-[#00f0ff] ml-1" />}
          {isGameOver && <ShieldAlert className="w-7 h-7 text-[#ff3366]" />}
          {isVictory && <Trophy className="w-7 h-7 text-[#ffe600]" />}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold tracking-widest text-[#ffd978] uppercase mb-1 font-cinzel">
          {isPaused && 'TACTICAL SIMULATION PAUSED'}
          {isGameOver && 'DEFENSE GRID COMPROMISED'}
          {isVictory && 'SOVEREIGN SUPREMACY ACHIEVED'}
        </h2>

        <p className="text-xs text-[#a6b7cd] mb-6">
          {isPaused && 'Standby mode active. All vector telemetry frozen.'}
          {isGameOver && 'The Mukaab Interceptor sustained catastrophic failure.'}
          {isVictory && 'All 221 sovereign realms successfully defended.'}
        </p>

        {/* Stats Summary Grid */}
        <div className="grid grid-cols-2 gap-2 mb-6 text-left">
          <div className="p-2.5 bg-black/60 rounded border border-white/10">
            <div className="text-[9px] text-[#a6b7cd] uppercase">Tactical Score</div>
            <div className="text-base font-bold text-[#ffd978] tabular-nums">
              {stats.score.toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 bg-black/60 rounded border border-white/10">
            <div className="text-[9px] text-[#a6b7cd] uppercase">Wave Achieved</div>
            <div className="text-base font-bold text-[#00f0ff] tabular-nums">
              Wave {stats.wave}
            </div>
          </div>
          <div className="p-2.5 bg-black/60 rounded border border-white/10">
            <div className="text-[9px] text-[#a6b7cd] uppercase">Vectors Neutralized</div>
            <div className="text-base font-bold text-[#ffd978] tabular-nums">
              {stats.enemiesDestroyed}
            </div>
          </div>
          <div className="p-2.5 bg-black/60 rounded border border-white/10">
            <div className="text-[9px] text-[#a6b7cd] uppercase">Pulses Fired</div>
            <div className="text-base font-bold text-[#00f0ff] tabular-nums">
              {stats.pulsesFired}
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex flex-col gap-2">
          {isPaused ? (
            <button
              onClick={() => {
                sound.playClick();
                onResume();
              }}
              className="w-full py-3 bg-gradient-to-r from-[#dfb15b] to-[#ffd978] hover:from-[#ffd978] hover:to-[#ffe600] text-black font-bold text-xs uppercase tracking-wider rounded shadow-lg transition-transform hover:scale-[1.02] cursor-pointer"
            >
              RESUME MISSION [ESC / SPACE]
            </button>
          ) : (
            <button
              onClick={() => {
                sound.playClick();
                onRestart();
              }}
              className="w-full py-3 bg-gradient-to-r from-[#dfb15b] to-[#ffd978] hover:from-[#ffd978] hover:to-[#ffe600] text-black font-bold text-xs uppercase tracking-wider rounded shadow-lg transition-transform hover:scale-[1.02] cursor-pointer"
            >
              RE-ENGAGE NEXUS [ENTER / SPACE]
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenConsole();
            }}
            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-[#a6b7cd] hover:text-white text-xs uppercase tracking-wider rounded transition-colors"
          >
            Review Command Telemetry (Ctrl+K)
          </button>
        </div>
      </div>
    </div>
  );
};
