import React from 'react';
import { BossLiveState } from '../types/game';

interface BossStatusBarProps {
  boss: BossLiveState | null;
}

export const BossStatusBar: React.FC<BossStatusBarProps> = ({ boss }) => {
  if (!boss || boss.isDefeated) return null;

  const hpPercent = Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100));
  const shieldPercent =
    boss.maxShield > 0 && boss.shieldActive
      ? Math.max(0, Math.min(100, (boss.shieldHealth / boss.maxShield) * 100))
      : 0;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-xl px-4 animate-in fade-in duration-300">
      <div className="bg-[#0b0e17]/90 border border-red-500/30 rounded-lg p-3 shadow-2xl backdrop-blur-none">
        {/* Boss Header Info */}
        <div className="flex items-center justify-between mb-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold tracking-wider">{boss.name}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">·</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">{boss.title}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-300">
            <span>
              PHASE {boss.currentPhase} / {boss.totalPhases}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-red-400 font-bold">{Math.round(hpPercent)}%</span>
          </div>
        </div>

        {/* Dual Health / Shield Gauge Bar */}
        <div className="relative h-2.5 w-full bg-slate-900 rounded overflow-hidden border border-slate-800">
          {/* Phase Dividing Markers */}
          {boss.totalPhases === 3 && (
            <>
              <div className="absolute top-0 bottom-0 left-[33.3%] w-[1px] bg-slate-700/80 z-10" />
              <div className="absolute top-0 bottom-0 left-[66.6%] w-[1px] bg-slate-700/80 z-10" />
            </>
          )}
          {boss.totalPhases === 2 && (
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-700/80 z-10" />
          )}

          {/* Primary Boss HP */}
          <div
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-150"
            style={{ width: `${hpPercent}%` }}
          />

          {/* Shield Overlay Bar (if shield active) */}
          {boss.shieldActive && (
            <div
              className="absolute inset-0 bg-cyan-400/70 border-r border-white shadow-[0_0_12px_rgba(0,240,255,0.8)] transition-all duration-100"
              style={{ width: `${shieldPercent}%` }}
            />
          )}
        </div>

        {/* Dynamic Telegraph Alert Sub-bar */}
        {boss.telegraphAttack && boss.telegraphAttack.active && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/40 rounded px-2.5 py-1">
            <span className="font-semibold tracking-wide uppercase">
              WARNING: {boss.telegraphAttack.name}
            </span>
            <span className="font-mono tabular-nums">
              BLAST IN {(2.0 * (1.0 - boss.telegraphAttack.progress)).toFixed(1)}s
            </span>
          </div>
        )}

        {/* Shield Status indicator */}
        {boss.shieldActive && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-cyan-300">
            <span>AEGIS DEFLECTOR WARD ACTIVE</span>
            <span>·</span>
            <span className="font-mono tabular-nums">{Math.round(boss.shieldHealth)} SP</span>
          </div>
        )}
      </div>
    </div>
  );
};
