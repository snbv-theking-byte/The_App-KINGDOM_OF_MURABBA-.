import React, { useEffect, useRef, useState } from 'react';
import { X, Search, Copy, Download, Radio, Volume2, VolumeX, Shield, Check, Globe } from 'lucide-react';
import { KEY_RADAR_NODES, RAW_COALITION_SUMMARY, SANITIZED_MANIFESTO, TOTEMS } from '../data/sovereignData';
import { SovereignNode, TelemetryLogEntry, TotemId } from '../types/game';
import { sound } from '../audio/SoundSynth';

interface TacticalConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetryLogs: TelemetryLogEntry[];
  activeTotem: TotemId;
  onSelectTotem: (id: TotemId) => void;
  onTriggerPulse: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  uptimeSeconds: number;
  pulsesCount: number;
}

export const TacticalConsoleModal: React.FC<TacticalConsoleModalProps> = ({
  isOpen,
  onClose,
  telemetryLogs,
  activeTotem,
  onSelectTotem,
  onTriggerPulse,
  audioMuted,
  onToggleAudio,
  crtEnabled,
  onToggleCrt,
  uptimeSeconds,
  pulsesCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<{
    name: string;
    spec: string;
    freq: string;
    x: number;
    y: number;
  } | null>(null);

  // Radar animation & high-DPI normalization
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    let isRunning = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(cx, cy) * 0.88;

      ctx.clearRect(0, 0, w, h);

      // Radar Concentric Circles
      ctx.strokeStyle = 'rgba(223, 177, 91, 0.18)';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxRadius / 3) * r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Coordinate Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.strokeStyle = 'rgba(223, 177, 91, 0.14)';
      ctx.stroke();

      // Render Sovereign Nodes
      KEY_RADAR_NODES.forEach(node => {
        const nx = node.xRatio * w;
        const ny = node.yRatio * h;

        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fill();

        // Vector line to nexus
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        ctx.fillStyle = 'rgba(240, 246, 252, 0.70)';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(node.name, nx + 7, ny - 3);
      });

      // Rotating Radar Sweep Cone
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
      sweepGrad.addColorStop(0, 'rgba(223, 177, 91, 0.28)');
      sweepGrad.addColorStop(1, 'rgba(223, 177, 91, 0)');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxRadius, 0, 0.42);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxRadius, 0);
      ctx.strokeStyle = 'rgba(255, 217, 120, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      angle += 0.025;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isOpen]);

  // Euclidean hit-testing on mouse move over radar canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: typeof hoveredNode = null;
    for (const node of KEY_RADAR_NODES) {
      const nx = node.xRatio * rect.width;
      const ny = node.yRatio * rect.height;
      const dist = Math.hypot(mx - nx, my - ny);
      if (dist < 14) {
        found = {
          name: node.name,
          spec: node.spec,
          freq: node.freq,
          x: nx,
          y: ny,
        };
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleCopyManifesto = async () => {
    sound.playClick();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(SANITIZED_MANIFESTO);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = SANITIZED_MANIFESTO;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Memory-safe log export
  const handleExportTelemetry = () => {
    sound.playClick();
    const logText = telemetryLogs.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MURABBA_SNBV_TELEMETRY_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Defer URL revocation safely
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 200);
  };

  if (!isOpen) return null;

  // Format uptime
  const hrs = String(Math.floor(uptimeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(Math.floor(uptimeSeconds % 60)).padStart(2, '0');

  // Filter commands / totems
  const filteredTotems = Object.values(TOTEMS).filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.abilityName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none overflow-y-auto"
    >
      <div className="bg-[#07090e] border border-[#dfb15b]/45 rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono-custom">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#dfb15b]/30 bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffe600] shadow-[0_0_8px_#ffe600]" />
            <h2 className="text-sm font-bold tracking-wider text-[#ffd978] uppercase">
              KINGDOM OF MURABBA™ · COMMAND CORE v3
            </h2>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] text-[#dfb15b] bg-[#dfb15b]/10 border border-[#dfb15b]/40 rounded">
              Φ = 1.618036
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs text-[#a6b7cd]">
              <span>
                UPTIME: <strong className="text-[#00f0ff]">{hrs}:{mins}:{secs}</strong>
              </span>
              <span>
                PULSES: <strong className="text-[#ffd978]">{pulsesCount}</strong>
              </span>
              <span>
                LOGS: <strong className="text-[#00f0ff]">{telemetryLogs.length}</strong>
              </span>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1 hover:bg-white/10 rounded text-[#a6b7cd] hover:text-white transition-colors cursor-pointer"
              aria-label="Close Command Core"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Command Filter Input */}
        <div className="px-5 py-2.5 border-b border-white/10 bg-black/40 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#dfb15b]" />
          <input
            type="text"
            placeholder="Type command or search totem..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-white placeholder-[#a6b7cd]/50 focus:outline-none"
          />
        </div>

        {/* Modal Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (5 cols): Mukaab Core, Guard Badge & 7-Axis Totems */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Guardia d'Élite Badge */}
            <div className="bg-gradient-to-br from-[#ffe600]/15 to-[#dfb15b]/5 border border-[#ffe600] rounded p-3 text-center">
              <div className="text-xs font-bold text-[#ffe600] tracking-wider">
                GUARDIA D&apos;ÈLITE MURABBA™
              </div>
              <div className="text-[11px] font-bold text-[#ffd978] mt-0.5">
                &quot;CASCHI GIALLI&quot;™
              </div>
              <div className="text-sm tracking-[0.35em] text-[#ffd978] my-1 font-mono-custom">
                [ ⤃ ⤇ ⤅ ⤉ ⤄ ]
              </div>
              <div className="text-[10px] text-[#a6b7cd]">
                MURABBA™ FIELD MARSHAL PROTOCOL · 460,000E RESONANCE
              </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-black/40 border border-white/10">
                <div className="text-[9px] text-[#a6b7cd] uppercase">Commander Sovereign</div>
                <div className="font-bold text-[#ffd978] truncate">SERGIO N. BERLANGA V.</div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/10">
                <div className="text-[9px] text-[#a6b7cd] uppercase">Codename Matrix</div>
                <div className="font-bold text-[#00f0ff] truncate">CHEk0 Berlanga™</div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/10">
                <div className="text-[9px] text-[#a6b7cd] uppercase">Power Resonance</div>
                <div className="font-bold text-[#ffd978]">460,000E</div>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/10">
                <div className="text-[9px] text-[#a6b7cd] uppercase">Active Nations</div>
                <div className="font-bold text-[#00f0ff]">221 Connected</div>
              </div>
            </div>

            {/* 7 Totemic Nodes Roster */}
            <div>
              <div className="text-xs font-bold text-[#dfb15b] uppercase mb-2 flex items-center justify-between">
                <span>Totemic Nodes (7-Axis)</span>
                <span className="text-[10px] text-[#a6b7cd]">ACTIVE NEXUS</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {filteredTotems.map(totem => {
                  const isSelected = activeTotem === totem.id;
                  return (
                    <button
                      key={totem.id}
                      onClick={() => {
                        sound.playClick();
                        onSelectTotem(totem.id);
                      }}
                      className={`p-2 rounded text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#dfb15b]/20 border-[#ffd978]'
                          : 'bg-black/30 border-white/10 hover:bg-white/5 hover:border-[#dfb15b]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-bold text-[#ffd978]">{totem.code}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.2 rounded"
                          style={{ backgroundColor: `${totem.color}25`, color: totem.color }}
                        >
                          {totem.abilityName}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#f0f6fc]">{totem.name}</div>
                      <div className="text-[10px] text-[#a6b7cd] truncate mt-0.5">{totem.holder}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Radar Canvas, Coalition Table & Live Stream */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Strategic Vector Radar */}
            <div className="bg-black/70 border border-[#dfb15b]/35 rounded p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#dfb15b]">STRATEGIC VECTOR RADAR</span>
                <span className="px-2 py-0.5 text-[10px] bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 rounded font-bold">
                  221 REALMS TRACKED
                </span>
              </div>

              {/* Canvas with Tooltip */}
              <div className="relative w-full h-[180px] bg-[#030508] border border-white/10 rounded overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="w-full h-full block cursor-crosshair"
                />

                {hoveredNode && (
                  <div
                    className="absolute pointer-events-none bg-[#07090e]/95 border border-[#00f0ff] rounded p-2 text-[10px] text-white shadow-xl z-20"
                    style={{ left: `${hoveredNode.x + 10}px`, top: `${hoveredNode.y - 10}px` }}
                  >
                    <div className="font-bold text-[#00f0ff]">{hoveredNode.name}</div>
                    <div className="text-[#ffd978]">{hoveredNode.spec}</div>
                    <div className="text-[#a6b7cd] text-[9px]">FREQ: {hoveredNode.freq}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Coalition Summary Table */}
            <div className="bg-black/60 border border-white/10 rounded overflow-hidden max-h-[170px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#0d1117] text-[#dfb15b] sticky top-0 border-b border-white/10">
                  <tr>
                    <th className="p-2">Domain / Sovereign Entity</th>
                    <th className="p-2">Nodes</th>
                    <th className="p-2">Strategic Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {RAW_COALITION_SUMMARY.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-2 font-semibold text-[#f0f6fc]">{row.domain}</td>
                      <td className="p-2 text-[#ffd978] font-bold">{row.nodes}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            row.laser
                              ? 'bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/40'
                              : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'
                          }`}
                        >
                          {row.spec}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Telemetry Stream Terminal */}
            <div className="bg-black/80 border border-white/10 rounded p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-[#ffd978]">REAL-TIME TELEMETRY STREAM</span>
                <span className="text-[10px] text-[#a6b7cd]">PORT: slack.com:320</span>
              </div>
              <div className="h-[120px] overflow-y-auto font-mono text-[11px] leading-relaxed text-[#8be9fd] bg-[#020305] p-2 rounded border border-white/5 space-y-1">
                {telemetryLogs.slice(-15).map(l => (
                  <div key={l.id} className="break-all">
                    <span className="text-[#a6b7cd]">[{l.timestamp}]</span>{' '}
                    <span
                      className={
                        l.type === 'ALERT'
                          ? 'text-[#ff3366] font-bold'
                          : l.type === 'SUCCESS'
                          ? 'text-[#ffe600] font-bold'
                          : l.type === 'TOTEM'
                          ? 'text-[#00f0ff]'
                          : 'text-[#8be9fd]'
                      }
                    >
                      {l.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-[#dfb15b]/25 bg-[#0d1117] text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playLaser(true);
                onTriggerPulse();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#dfb15b]/20 to-[#825f1b]/30 hover:from-[#ffd978] hover:to-[#dfb15b] border border-[#dfb15b] text-[#ffd978] hover:text-black font-bold rounded transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Transmit Global Pulse</span>
            </button>

            <button
              onClick={handleCopyManifesto}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-white/10 border border-white/20 text-[#f0f6fc] rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Manifesto Copied!' : 'Copy Manifesto'}</span>
            </button>

            <button
              onClick={handleExportTelemetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-white/10 border border-white/20 text-[#a6b7cd] hover:text-white rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Telemetry (.txt)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onToggleAudio();
              }}
              className="px-2.5 py-1 text-xs border border-white/20 rounded hover:bg-white/10 text-[#a6b7cd]"
            >
              Sound: {audioMuted ? 'Off' : 'On'}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onToggleCrt();
              }}
              className="px-2.5 py-1 text-xs border border-white/20 rounded hover:bg-white/10 text-[#a6b7cd]"
            >
              CRT: {crtEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
