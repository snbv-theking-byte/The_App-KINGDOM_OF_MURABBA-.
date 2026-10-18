import React from 'react';
import { Video, Play, ArrowRight, RotateCcw, Map } from 'lucide-react';
import { ChapterConfig, ChapterId } from '../types/game';

interface ChapterClearModalProps {
  summary: {
    chapter: ChapterConfig;
    stars: number;
    newlyUnlocked: ChapterId | null;
    score: number;
    timeSeconds: number;
    nodesPreserved: number;
  } | null;
  onNextChapter: (chapterId: ChapterId) => void;
  onReplayChapter: (chapterId: ChapterId) => void;
  onOpenCampaignSelect: () => void;
  onStartCinematicReplay: () => void;
}

export const ChapterClearModal: React.FC<ChapterClearModalProps> = ({
  summary,
  onNextChapter,
  onReplayChapter,
  onOpenCampaignSelect,
  onStartCinematicReplay,
}) => {
  if (!summary) return null;

  const { chapter, stars, newlyUnlocked, score, timeSeconds, nodesPreserved } = summary;
  const hasNext = chapter.id < 4;
  const nextId = (chapter.id + 1) as ChapterId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-[#0b0e17] border border-amber-500/40 rounded-xl shadow-2xl p-6 text-slate-200 text-center space-y-6">
        {/* Glow Crest */}
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-2xl text-amber-400">
          ✦
        </div>

        <div>
          <div className="text-xs font-mono text-amber-400 tracking-wider">
            {chapter.code} // SECTOR SECURED
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">{chapter.title}</h2>
          <div className="text-xs text-slate-400 mt-1">
            Titan Neutralized: {chapter.boss.name}
          </div>
        </div>

        {/* Accolade Stars */}
        <div className="flex items-center justify-center gap-2 text-2xl text-amber-400 font-mono">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={i < stars ? 'text-amber-400' : 'text-slate-700'}>
              ★
            </span>
          ))}
        </div>

        {/* Performance Breakdown Table */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900/80 rounded-lg border border-slate-800 text-left text-xs">
          <div>
            <span className="text-slate-400">Tactical Score:</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {score.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Time Elapsed:</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {timeSeconds}s
            </div>
          </div>
          <div>
            <span className="text-slate-400">Alliance Relays Intact:</span>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {nodesPreserved} / 221
            </div>
          </div>
          <div>
            <span className="text-slate-400">Resonance Yield:</span>
            <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
              460,000E Pure
            </div>
          </div>
        </div>

        {/* Unlock Notice Banner */}
        {newlyUnlocked && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-300">
            <span className="font-semibold">NEW SECTOR UNLOCKED:</span> Chapter {newlyUnlocked} is now operational!
          </div>
        )}

        {/* Cinematic Replay CTA Banner */}
        <button
          onClick={onStartCinematicReplay}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-500/50 rounded-lg text-amber-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
        >
          <Video className="w-4 h-4 text-amber-400" />
          <span>Cinematic Battlefield Replay (Enemy POV Flythrough)</span>
        </button>

        {/* Progression Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {hasNext ? (
            <button
              onClick={() => onNextChapter(nextId)}
              className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <span>Advance to Chapter {nextId}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenCampaignSelect}
              className="flex-1 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Campaign Completed!
            </button>
          )}

          <button
            onClick={() => onReplayChapter(chapter.id)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>

          <button
            onClick={onOpenCampaignSelect}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <Map className="w-3.5 h-3.5" />
            <span>Sectors</span>
          </button>
        </div>
      </div>
    </div>
  );
};
