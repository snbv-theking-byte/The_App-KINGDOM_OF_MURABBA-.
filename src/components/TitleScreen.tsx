import React from 'react';
import { Volume2, VolumeX, Monitor, Terminal, Shield } from 'lucide-react';
import { sound } from '../audio/SoundSynth';

interface TitleScreenProps {
  onStart: () => void;
  onOpenConsole: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onOpenConsole,
  audioMuted,
  onToggleAudio,
  crtEnabled,
  onToggleCrt,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffe600] shadow-[0_0_8px_#ffe600]" />
          <span className="text-xs tracking-wider text-[#a6b7cd] uppercase font-mono-custom">
            SNBV™ DEFENSE MATRIX · <span className="text-[#ffd978]">STATUS: SOVEREIGN ARMED</span>
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono-custom text-[#dfb15b] bg-[#dfb15b]/10 border border-[#dfb15b]/40 rounded">
            Φ = 1.618036
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              onToggleAudio();
            }}
            aria-label="Toggle Audio"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-custom bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#f0f6fc] hover:text-[#ffd978] rounded transition-colors"
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" />}
            <span>{audioMuted ? 'Muted' : 'Audio On'}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onToggleCrt();
            }}
            aria-label="Toggle CRT Scanline Overlay"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-custom bg-black/60 hover:bg-[#dfb15b]/20 border border-[#dfb15b]/30 text-[#f0f6fc] hover:text-[#ffd978] rounded transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-[#ffd978]" />
            <span>CRT {crtEnabled ? 'On' : 'Off'}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenConsole();
            }}
            aria-label="Open Command Console"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-custom bg-[#dfb15b]/15 hover:bg-[#dfb15b]/30 border border-[#dfb15b] text-[#ffd978] rounded transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console (Ctrl+K)</span>
          </button>
        </div>
      </div>

      {/* Center Cinematic Lockup with Bespoke SVG */}
      <div className="max-w-2xl mx-auto my-auto text-center flex flex-col items-center">
        {/* Guardia d'Élite Murabba Insignia */}
        <div className="mb-3 px-3 py-1 rounded bg-[#ffe600]/10 border border-[#ffe600]/40 text-[#ffe600] text-[11px] font-mono-custom font-bold tracking-widest inline-flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          <span>GUARDIA D&apos;ÈLITE MURABBA™ · CASCHI GIALLI™</span>
        </div>

        {/* Bespoke SVG Title Lockup */}
        <div className="w-full max-w-xl px-4 py-2">
          <svg viewBox="0 0 700 130" className="w-full h-auto drop-shadow-[0_0_20px_rgba(223,177,91,0.45)]">
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dfb15b" />
                <stop offset="50%" stopColor="#ffd978" />
                <stop offset="100%" stopColor="#dfb15b" />
              </linearGradient>
            </defs>
            <text
              x="50%"
              y="40"
              textAnchor="middle"
              fill="url(#goldGradient)"
              fontSize="38"
              fontFamily="Cinzel, serif"
              fontWeight="900"
              letterSpacing="7"
            >
              KINGDOM OF MURABBA™
            </text>
            <text
              x="50%"
              y="74"
              textAnchor="middle"
              fill="#00f0ff"
              fontSize="16"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              letterSpacing="6"
            >
              SNBV™ COMMAND CORE v3 · MUKAAB DEFENSE MATRIX
            </text>
            <text
              x="50%"
              y="108"
              textAnchor="middle"
              fill="#a6b7cd"
              fontSize="13"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="3"
            >
              400M CUBIC NEXUS · 221 SOVEREIGN NATIONS · 460,000E RESONANCE
            </text>
          </svg>
        </div>

        {/* Sigils Signature */}
        <div className="text-sm tracking-[0.4em] text-[#ffd978]/90 font-mono-custom my-2">
          [ ⤃ ⤇ ⤅ ⤉ ⤄ ]
        </div>

        <p className="text-xs text-[#a6b7cd] max-w-lg mb-8 leading-relaxed font-mono-custom">
          Field Marshal Interceptor standing by. Defend the sovereign coalition grid across Saudi Arabia, UAE, Egypt,
          and the 221 world domains from cyber-kinetic incursion vectors.
        </p>

        {/* Primary Start CTA */}
        <div className="pointer-events-auto flex flex-col items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onStart();
            }}
            className="group relative px-8 py-3.5 bg-gradient-to-b from-[#dfb15b]/30 to-[#825f1b]/40 hover:from-[#ffd978] hover:to-[#dfb15b] border-2 border-[#dfb15b] hover:border-[#ffd978] text-[#ffd978] hover:text-black font-mono-custom text-sm font-bold tracking-widest uppercase rounded shadow-[0_0_24px_rgba(223,177,91,0.35)] hover:shadow-[0_0_35px_rgba(255,217,120,0.65)] transition-all cursor-pointer transform hover:scale-[1.03] active:scale-[0.98]"
          >
            [ ENTER / SPACE ] TO ENGAGE NEXUS
          </button>

          {/* Single Flat Control-Hint Line */}
          <div className="text-[11px] text-[#a6b7cd] tracking-wider font-mono-custom mt-2">
            WASD Move · Space / Click Laser · 1-7 Totem Shift · Q/E Φ-Pulse · Esc Pause
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#a6b7cd]/80 font-mono-custom border-t border-[#dfb15b]/20 pt-3">
        <div>COMMANDER: SERGIO N. BERLANGA V. [CHEk0 Berlanga™]</div>
        <div>PORT: kingofmurabba.slack.com:320 · LATENCY: 0.16ms</div>
      </div>
    </div>
  );
};
