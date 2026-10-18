import React from 'react';
import { Volume2, VolumeX, Monitor, Pause, Terminal, Zap, ShieldAlert, Eye, Map } from 'lucide-react';
import { CameraMode, PlayerStats, SovereignNode } from '../types/game';
import { TOTEMS } from '../data/sovereignData';
import { CAMPAIGN_CHAPTERS } from '../data/campaignData';
import { sound } from '../audio/SoundSynth';

interface PerimeterHudProps {
  stats: PlayerStats;
  nodes: SovereignNode[];
  onPause: () => void;
  onOpenConsole: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  cameraMode: CameraMode;
  onToggleCamera: () => void;
  onOpenCampaignSelect: () => void;
}

export const PerimeterHud: React.FC<PerimeterHudProps> = ({
  stats,
  nodes,
  onPause,
  onOpenConsole,
  audioMuted,
  onToggleAudio,
  crtEnabled,
  onToggleCrt,
  cameraMode,
  onToggleCamera,
  onOpenCampaignSelect,
}) => {
  const activeTotemSpec = TOTEMS[stats.activeTotem] || TOTEMS.A;
  const currentChapter = CAMPAIGN_CHAPTERS[stats.chapter] || CAMPAIGN_CHAPTERS[1];

  // Calculate live grid integrity
  const totalHealthyNodes = nodes.filter(n => n.status !== 'CRITICAL').length;
  const gridIntegrityPct = Math.round((totalHealthyNodes / Math.max(1, nodes.length)) * 100);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Status Bar Cluster */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Top-Left: Player Vitality & Totem Matrix */}
        <div className="pointer-events-auto bg-[#07090e]/85 border border-[#dfb15b]/35 p-3 rounded shadow-lg max-w-[280px] w-full">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-[#ffd978] tracking-wider uppercase font-mono-custom">
              MUKAAB INTERCEPTOR
            </span>
            <span className="px-1.5 py-0.5 text-[10px] bg-[#dfb15b]/20 text-[#ffd978] border border-[#dfb15b]/40 rounded font-mono-custom font-bold">
              x{stats.multiplier.toFixed(1)}
            </span>
          </div>

          {/* Shield Gauge */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[10px] text-[#00f0ff] font-mono-custom mb-0.5">
              <span>SHIELD DEFLECTOR</span>
              <span className="tabular-nums font-bold">{Math.round(stats.shield)}/100</span>
            </div>
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#00f0ff]/30">
              <div
                className="h-full bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, stats.shield))}%` }}
              />
            </div>
          </div>

          {/* Hull Integrity */}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] text-[#ffd978] font-mono-custom mb-0.5">
              <span>HULL INTEGRITY</span>
              <span className="tabular-nums font-bold">{Math.round(stats.hull)}/100</span>
            </div>
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#dfb15b]/30">
              <div
                className={`h-full transition-all duration-150 ${
                  stats.hull > 30 ? 'bg-gradient-to-r from-[#ffd978] to-[#dfb15b]' : 'bg-red-500 animate-pulse'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, stats.hull))}%` }}
              />
            </div>
          </div>

          {/* Active Totem Indicator */}
          <div className="pt-1.5 border-t border-[#dfb15b]/20 flex items-center justify-between text-[10px] font-mono-custom">
            <span className="text-[#a6b7cd]">TOTEM:</span>
            <span
              className="font-bold tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${activeTotemSpec.color}25`, color: activeTotemSpec.color }}
            >
              {activeTotemSpec.code} · {activeTotemSpec.name}
            </span>
          </div>
        </div>

        {/* Top-Center: Chapter, Wave & Grid Integrity Ribbon */}
        <div className="pointer-events-auto bg-[#07090e]/85 border border-[#dfb15b]/35 px-4 py-2 rounded shadow-lg text-center hidden md:flex flex-col items-center">
          <div className="flex items-center gap-2 mb-0.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-xs font-bold tracking-wider text-[#ffd978] font-mono-custom">
              {currentChapter.code} // {currentChapter.title}
            </span>
            <span className="text-xs text-[#00f0ff] font-mono-custom font-bold tabular-nums">
              {gridIntegrityPct}%
            </span>
          </div>
          <div className="text-[10px] text-[#a6b7cd] font-mono-custom flex items-center gap-2">
            <span>221 ALLIANCE RELAYS</span>
            <span aria-hidden="true">·</span>
            <span>
              WAVE <span className="text-[#ffd978] font-bold">{stats.wave}</span> / {stats.totalWavesInChapter}
            </span>
            {stats.bossActive && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-red-400 font-bold animate-pulse">TITAN ACTIVE</span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right: Score, 460,000E Resonance Gauge & Quick Controls */}
        <div className="pointer-events-auto bg-[#07090e]/85 border border-[#dfb15b]/35 p-3 rounded shadow-lg flex flex-col items-end gap-2">
          {/* Score Display */}
          <div className="text-right">
            <div className="text-[10px] text-[#a6b7cd] uppercase font-mono-custom">TACTICAL SCORE</div>
            <div className="text-xl sm:text-2xl font-black text-[#ffd978] font-mono-custom tracking-wider tabular-nums">
              {stats.score.toLocaleString()}
            </div>
          </div>

          {/* 460,000E Resonance Gauge */}
          <div className="w-full min-w-[190px]">
            <div className="flex justify-between items-center text-[10px] font-mono-custom mb-1">
              <span className="text-[#ffd978] flex items-center gap-1 font-bold">
                <Zap className="w-3 h-3 text-[#ffe600]" />
                <span>460,000E RESONANCE</span>
              </span>
              <span className="text-[#ffe600] font-bold tabular-nums">{Math.round(stats.resonance460k)}%</span>
            </div>
            <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-[#ffe600]/40">
              <div
                className={`h-full transition-all duration-200 ${
                  stats.resonance460k >= 100
                    ? 'bg-gradient-to-r from-[#ffe600] via-[#ffd978] to-[#00f0ff] animate-pulse'
                    : 'bg-gradient-to-r from-[#825f1b] to-[#ffd978]'
                }`}
                style={{ width: `${Math.min(100, stats.resonance460k)}%` }}
              />
            </div>
            {stats.resonance460k >= 100 && (
              <div className="text-[9px] text-[#ffe600] font-bold tracking-wider text-right mt-0.5 animate-pulse">
                [PRESS Q / E] Φ-WAVE READY!
              </div>
            )}
          </div>

          {/* Quick HUD Buttons */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-[#dfb15b]/20">
            {/* Camera View Switcher */}
            <button
              onClick={() => {
                sound.playClick();
                onToggleCamera();
              }}
              title="Toggle Camera View (Hotkey C)"
              className="flex items-center gap-1 px-2 py-1 bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#00f0ff] text-[10px] font-mono-custom font-bold rounded transition-colors"
            >
              <Eye className="w-3 h-3 text-[#00f0ff]" />
              <span>{cameraMode === 'CHASE' ? 'OVERVIEW' : 'CHASE'}</span>
            </button>

            {/* Campaign Select Modal Launcher */}
            <button
              onClick={() => {
                sound.playClick();
                onOpenCampaignSelect();
              }}
              title="Campaign Sectors"
              className="p-1.5 bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#ffd978] rounded transition-colors"
            >
              <Map className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onToggleAudio();
              }}
              title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#f0f6fc] hover:text-[#ffd978] rounded transition-colors"
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" />}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onToggleCrt();
              }}
              title="Toggle CRT Filter"
              className="p-1.5 bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#f0f6fc] hover:text-[#ffd978] rounded transition-colors"
            >
              <Monitor className="w-3.5 h-3.5 text-[#ffd978]" />
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onPause();
              }}
              title="Pause Game (Esc)"
              className="p-1.5 bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#f0f6fc] hover:text-[#ffd978] rounded transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onOpenConsole();
              }}
              title="Tactical Console (Ctrl+K / Tab)"
              className="flex items-center gap-1 px-2 py-1 bg-[#dfb15b]/20 hover:bg-[#dfb15b]/35 border border-[#dfb15b] text-[#ffd978] text-[10px] font-mono-custom font-bold rounded transition-colors"
            >
              <Terminal className="w-3 h-3" />
              <span>⌘K</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
