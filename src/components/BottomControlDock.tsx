import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Radio, Zap, Shield, Sparkles, Terminal } from 'lucide-react';
import { TotemId, TotemSpec } from '../types/game';
import { TOTEMS } from '../data/sovereignData';
import { sound } from '../audio/SoundSynth';

interface BottomControlDockProps {
  activeTotem: TotemId;
  onSelectTotem: (id: TotemId) => void;
  onTriggerPulse: () => void;
  onTriggerHarmonicWave: () => void;
  onOpenConsole: () => void;
  resonance460k: number;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  activeTotem,
  onSelectTotem,
  onTriggerPulse,
  onTriggerHarmonicWave,
  onOpenConsole,
  resonance460k,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totemList: TotemSpec[] = Object.values(TOTEMS);
  const activeSpec = TOTEMS[activeTotem] || TOTEMS.A;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-[940px] transition-transform duration-300 ease-out select-none ${
        isCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse/Expand Toggle Tab */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => {
            sound.playClick();
            setIsCollapsed(!isCollapsed);
          }}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#0d1117] border border-[#dfb15b]/40 rounded-t text-[11px] font-mono-custom text-[#ffd978] hover:bg-[#dfb15b]/20 transition-colors shadow-md cursor-pointer"
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isCollapsed ? 'Show Tactical Dock (H)' : 'Hide Dock (H)'}</span>
        </button>
      </div>

      {/* Main Glassmorphic Dock Container */}
      <div className="bg-[#07090e]/95 border border-[#dfb15b]/35 rounded-lg p-3 shadow-2xl">
        {/* Totem Selector Row (Keys 1-7) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 mb-2.5">
          {totemList.map((totem, index) => {
            const isSelected = activeTotem === totem.id;
            const keyNum = index + 1;

            return (
              <button
                key={totem.id}
                onClick={() => {
                  sound.playClick();
                  onSelectTotem(totem.id);
                }}
                className={`p-1.5 rounded border text-left font-mono-custom transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#dfb15b]/25 border-[#ffd978] shadow-[0_0_12px_rgba(223,177,91,0.35)]'
                    : 'bg-black/50 border-white/10 hover:border-[#dfb15b]/50 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="font-bold text-[#ffd978]">{totem.code}</span>
                  <span className="text-[9px] px-1 bg-white/10 rounded text-[#a6b7cd]">{keyNum}</span>
                </div>
                <div className="text-[10px] text-[#f0f6fc] truncate font-semibold" title={totem.name}>
                  {totem.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Action Ribbon & Active Totem Lore Detail */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#dfb15b]/20 text-[11px] font-mono-custom">
          {/* Active Totem Spec Preview */}
          <div className="flex items-center gap-2 text-xs truncate max-w-md">
            <span
              className="px-2 py-0.5 rounded font-bold"
              style={{ backgroundColor: `${activeSpec.color}25`, color: activeSpec.color }}
            >
              {activeSpec.abilityName}
            </span>
            <span className="text-[#a6b7cd] text-[11px] truncate hidden md:inline">
              Holder: {activeSpec.holder}
            </span>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onTriggerPulse();
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#dfb15b]/20 to-[#825f1b]/30 hover:from-[#ffd978] hover:to-[#dfb15b] border border-[#dfb15b] text-[#ffd978] hover:text-black font-bold rounded transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Laser Pulse</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onTriggerHarmonicWave();
              }}
              disabled={resonance460k < 100}
              className={`flex items-center gap-1 px-2.5 py-1 border font-bold rounded transition-all ${
                resonance460k >= 100
                  ? 'bg-gradient-to-r from-[#ffe600] to-[#ffd978] border-[#ffe600] text-black shadow-[0_0_15px_#ffe600] animate-pulse cursor-pointer'
                  : 'bg-black/40 border-white/10 text-[#a6b7cd]/60 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Φ-Wave (Q/E)</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onOpenConsole();
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0d1117] hover:bg-white/10 border border-white/20 text-[#00f0ff] rounded transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
