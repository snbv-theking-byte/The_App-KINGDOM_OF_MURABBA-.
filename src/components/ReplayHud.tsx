import React from 'react';
import { Play, Pause, FastForward, Eye, X, Crosshair, Sparkles } from 'lucide-react';
import { ReplayCameraPerspective, ReplayState } from '../types/game';
import { TOTEMS } from '../data/sovereignData';
import { sound } from '../audio/SoundSynth';

interface ReplayHudProps {
  replay: ReplayState;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onSetPerspective: (perspective: ReplayCameraPerspective) => void;
  onExitReplay: () => void;
}

export const ReplayHud: React.FC<ReplayHudProps> = ({
  replay,
  onTogglePause,
  onSetSpeed,
  onSetPerspective,
  onExitReplay,
}) => {
  const currentKill = replay.currentKill;
  const totem = currentKill?.fatalTotem ? TOTEMS[currentKill.fatalTotem] : null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none select-none flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Top Telemetry Overlay */}
      <div className="flex flex-wrap items-start justify-between gap-3 pointer-events-auto">
        {/* Left: Replay Mode Header & Focused Kill Dossier */}
        <div className="bg-[#0b0e17]/90 border border-amber-500/40 rounded-lg p-3.5 shadow-2xl max-w-md w-full backdrop-blur-none text-slate-200">
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="font-bold text-amber-400 tracking-wider font-mono">
                BATTLEFIELD REPLAY FLYTHROUGH
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              KILL {replay.currentIndex + 1} / {replay.totalKills}
            </span>
          </div>

          {currentKill && (
            <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  {currentKill.enemyName}
                </span>
                <span className="font-mono text-[11px] text-amber-400">
                  +{currentKill.scoreValue} PTS
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>
                  VECTOR [X: {currentKill.position.x.toFixed(1)}, Z: {currentKill.position.z.toFixed(1)}]
                </span>
                <span>·</span>
                {totem && (
                  <span style={{ color: totem.color }}>
                    FATAL: {totem.code} ({totem.abilityName})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Exit Replay Button */}
        <button
          onClick={() => {
            sound.playClick();
            onExitReplay();
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 text-rose-400" />
          <span>Exit Replay (Esc)</span>
        </button>
      </div>

      {/* Bottom Timeline & Camera Perspective Dock */}
      <div className="pointer-events-auto max-w-2xl mx-auto w-full bg-[#0b0e17]/95 border border-slate-800 rounded-xl p-3.5 shadow-2xl space-y-3">
        {/* Progress Scrubber Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>CHRONOLOGICAL DESTRUCTION VECTOR</span>
            <span className="tabular-nums">
              {Math.round(replay.progress * 100)}%
            </span>
          </div>
          <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-400 transition-all duration-100"
              style={{ width: `${Math.min(100, replay.progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Playback Controls & Perspective Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          {/* Play/Pause & Speed */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePause}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded font-semibold transition-colors cursor-pointer"
            >
              {replay.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{replay.isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
              {[0.5, 1.0, 2.0].map(spd => (
                <button
                  key={spd}
                  onClick={() => onSetSpeed(spd)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    replay.playbackSpeed === spd
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Perspective Selector Tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Camera:</span>
            {(
              [
                { id: 'ENEMY_POV', label: 'Enemy POV [V]' },
                { id: 'CHASE_TRAIL', label: 'Chase Trail [V]' },
                { id: 'ORBITAL_SWEEP', label: 'Orbital Sweep [V]' },
              ] as const
            ).map(p => (
              <button
                key={p.id}
                onClick={() => onSetPerspective(p.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                  replay.cameraPerspective === p.id
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 font-semibold shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
