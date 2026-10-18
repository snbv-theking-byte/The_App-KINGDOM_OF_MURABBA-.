import React, { useState } from 'react';
import { CAMPAIGN_CHAPTERS } from '../data/campaignData';
import { CampaignProgress, ChapterId } from '../types/game';

interface CampaignSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapterId: ChapterId) => void;
  progress: CampaignProgress;
  activeChapterId: ChapterId;
}

export const CampaignSelectModal: React.FC<CampaignSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectChapter,
  progress,
  activeChapterId,
}) => {
  const [selectedId, setSelectedId] = useState<ChapterId>(activeChapterId);

  if (!isOpen) return null;

  const chapters = [1, 2, 3, 4] as ChapterId[];
  const selectedConfig = CAMPAIGN_CHAPTERS[selectedId];
  const selectedRecord = progress.chapterRecords[selectedId];
  const isSelectedUnlocked = progress.unlockedChapters.includes(selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-none">
      <div className="relative w-full max-w-4xl bg-[#0b0e17] border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Sovereign Campaign Operations
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>221 Sovereign Alliance Grid</span>
              <span aria-hidden="true">·</span>
              <span>4 Strategic Sectors</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-mono">
                {Object.values(progress.chapterRecords).reduce((acc, r) => acc + (r?.stars || 0), 0)} / 12 Accolade Stars
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Main Body (2 Columns: Chapter List + Sector Dossier) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Column: Chapter List */}
          <div className="md:col-span-5 p-4 border-b md:border-b-0 md:border-r border-slate-800 space-y-2 bg-[#090b12]">
            {chapters.map(id => {
              const ch = CAMPAIGN_CHAPTERS[id];
              const isUnlocked = progress.unlockedChapters.includes(id);
              const isSelected = selectedId === id;
              const rec = progress.chapterRecords[id];

              return (
                <button
                  key={id}
                  disabled={!isUnlocked}
                  onClick={() => setSelectedId(id)}
                  className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : isUnlocked
                      ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900/80 text-slate-600 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono tracking-wider text-slate-400">
                      {ch.code}
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      {isUnlocked ? (
                        <span className="text-amber-400 font-mono">
                          {'★'.repeat(rec?.stars || 0)}
                          {'☆'.repeat(3 - (rec?.stars || 0))}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">LOCKED</span>
                      )}
                    </div>
                  </div>
                  <div className="font-semibold text-sm mt-1">{ch.title}</div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{ch.subtitle}</div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Chapter Tactical Brief */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono text-amber-400 tracking-wider">
                  {selectedConfig.sectorName}
                </div>
                <h3 className="text-xl font-bold text-white mt-1">{selectedConfig.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Threat: {selectedConfig.threatLevel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedConfig.totalWaves} Combat Waves</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedConfig.realmNodes.length} Key Defense Relays</span>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedConfig.description}
              </p>

              {/* Boss Intelligence Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="text-xs font-mono text-red-400 tracking-wider">
                  TITAN ENCOUNTER DOSSIER
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-white">
                    {selectedConfig.boss.name}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    HP: {selectedConfig.boss.maxHealth} · {selectedConfig.boss.phases} Phases
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {selectedConfig.boss.subtitle}
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                  <span className="text-slate-400">Tactics:</span>
                  {selectedConfig.boss.abilities.map((ab, idx) => (
                    <span key={idx} className="after:content-['·'] after:ml-1.5 last:after:content-none text-slate-300">
                      {ab}
                    </span>
                  ))}
                </div>
              </div>

              {/* Records and Accolades */}
              {selectedRecord && isSelectedUnlocked && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-center">
                  <div>
                    <div className="text-[10px] text-slate-500 font-mono">HIGH SCORE</div>
                    <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                      {selectedRecord.highScore.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-mono">BEST TIME</div>
                    <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                      {selectedRecord.bestTimeSeconds > 0 ? `${selectedRecord.bestTimeSeconds}s` : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-mono">RELAYS PRESERVED</div>
                    <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                      {selectedRecord.nodesPreserved > 0 ? `${selectedRecord.nodesPreserved} / 221` : '--'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Action */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                Return to Command
              </button>
              <button
                disabled={!isSelectedUnlocked}
                onClick={() => {
                  onSelectChapter(selectedId);
                  onClose();
                }}
                className={`px-6 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isSelectedUnlocked
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSelectedUnlocked ? `Deploy to ${selectedConfig.title}` : 'Sector Locked'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
