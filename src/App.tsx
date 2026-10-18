import React, { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController';
import { ThreeGameScene } from './game/three/ThreeGameScene';
import { TitleScreen } from './components/TitleScreen';
import { PerimeterHud } from './components/PerimeterHud';
import { BottomControlDock } from './components/BottomControlDock';
import { TacticalConsoleModal } from './components/TacticalConsoleModal';
import { EndGameModal } from './components/EndGameModal';
import { BossStatusBar } from './components/BossStatusBar';
import { CampaignSelectModal } from './components/CampaignSelectModal';
import { ChapterClearModal } from './components/ChapterClearModal';
import { ReplayHud } from './components/ReplayHud';
import {
  BossLiveState,
  CameraMode,
  CampaignProgress,
  ChapterConfig,
  ChapterId,
  GameState,
  PlayerStats,
  ReplayCameraPerspective,
  ReplayState,
  SovereignNode,
  TelemetryLogEntry,
  TotemId,
} from './types/game';
import { KEY_RADAR_NODES } from './data/sovereignData';
import { loadCampaignProgress } from './data/campaignData';
import { MANIFESTO_CONFIG } from './data/manifestoData';
import { sound } from './audio/SoundSynth';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<GameController | null>(null);
  const threeSceneRef = useRef<ThreeGameScene | null>(null);

  // React State for UI HUD & Campaign
  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [cameraMode, setCameraMode] = useState<CameraMode>('CHASE');
  const [bossLiveState, setBossLiveState] = useState<BossLiveState | null>(null);
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress>(loadCampaignProgress());
  const [isCampaignSelectOpen, setIsCampaignSelectOpen] = useState(false);
  const [chapterClearSummary, setChapterClearSummary] = useState<{
    chapter: ChapterConfig;
    stars: number;
    newlyUnlocked: ChapterId | null;
    score: number;
    timeSeconds: number;
    nodesPreserved: number;
  } | null>(null);

  const [replayState, setReplayState] = useState<ReplayState>({
    active: false,
    currentIndex: 0,
    totalKills: 0,
    progress: 0,
    playbackSpeed: 1.0,
    isPaused: false,
    cameraPerspective: 'ENEMY_POV',
    currentKill: null,
    killHistory: [],
  });

  const [stats, setStats] = useState<PlayerStats>({
    hull: 100,
    maxHull: 100,
    shield: 100,
    maxShield: 100,
    energy: 100,
    maxEnergy: 100,
    score: 0,
    multiplier: 1.0,
    resonance460k: 15,
    chapter: 1,
    wave: 1,
    totalWavesInChapter: 3,
    activeTotem: (localStorage.getItem('snbv_totem') as TotemId) || 'A',
    pulsesFired: 0,
    enemiesDestroyed: 0,
    nodesPreserved: 221,
    uptimeSeconds: 0,
    bossActive: false,
  });

  const [nodes, setNodes] = useState<SovereignNode[]>(KEY_RADAR_NODES);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8) + 'Z',
      message: `${MANIFESTO_CONFIG.identity.token}] System boot complete. Active Core: ${MANIFESTO_CONFIG.realm.architecturalNexus}.`,
      type: 'INFO',
    },
    {
      id: 'init-2',
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8) + 'Z',
      message: `ALLIANCE MESH: ${MANIFESTO_CONFIG.scope.totalNations} sovereign realms operational. ${MANIFESTO_CONFIG.symbolism.formula}`,
      type: 'SUCCESS',
    },
  ]);

  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(sound.getMuted());
  const [crtEnabled, setCrtEnabled] = useState(localStorage.getItem('snbv_crt') !== 'false');

  // Initialize Three.js and Simulation Controller
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const threeScene = new ThreeGameScene(container);
    threeSceneRef.current = threeScene;

    const controller = new GameController(threeScene, {
      onStatsUpdate: newStats => setStats(newStats),
      onStateChange: newState => setGameState(newState),
      onLogTelemetry: entry => setTelemetryLogs(prev => [...prev.slice(-40), entry]),
      onNodesUpdate: newNodes => setNodes(newNodes),
      onBossUpdate: boss => setBossLiveState(boss),
      onChapterComplete: summary => {
        setChapterClearSummary(summary);
        setCampaignProgress(loadCampaignProgress());
      },
      onCameraModeChange: mode => setCameraMode(mode),
      onReplayUpdate: replay => setReplayState(replay),
    });
    controllerRef.current = controller;

    // Handle Window Resizing
    const handleResize = () => {
      threeScene.onResize();
    };
    window.addEventListener('resize', handleResize);

    // Global Key Listener for Ctrl+K, Tab, and Esc
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsConsoleOpen(prev => !prev);
        sound.playClick();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setIsConsoleOpen(prev => !prev);
        sound.playClick();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleGlobalKey);
      controller.dispose();
      threeScene.dispose();
    };
  }, []);

  // UI Handlers
  const handleStartGame = () => {
    controllerRef.current?.startChapter(stats.chapter);
  };

  const handleSelectChapter = (chapterId: ChapterId) => {
    controllerRef.current?.startChapter(chapterId);
  };

  const handlePauseGame = () => {
    controllerRef.current?.pauseGame();
  };

  const handleResumeGame = () => {
    controllerRef.current?.resumeGame();
  };

  const handleRestartGame = () => {
    controllerRef.current?.restartGame();
  };

  const handleSelectTotem = (id: TotemId) => {
    localStorage.setItem('snbv_totem', id);
    controllerRef.current?.switchTotem(id);
  };

  const handleToggleCamera = () => {
    controllerRef.current?.toggleCameraMode();
  };

  const handleTriggerPulse = () => {
    if (gameState === 'PLAYING') {
      sound.playLaser(true);
      controllerRef.current?.switchTotem(stats.activeTotem);
    } else {
      sound.playLaser(true);
    }
  };

  const handleTriggerHarmonicWave = () => {
    controllerRef.current?.triggerPhiHarmonicWave();
  };

  const handleToggleAudio = () => {
    const newMuted = !sound.toggleMute();
    setAudioMuted(newMuted);
  };

  const handleToggleCrt = () => {
    setCrtEnabled(prev => {
      const next = !prev;
      localStorage.setItem('snbv_crt', next ? 'true' : 'false');
      return next;
    });
  };

  const handleNextChapter = (chapterId: ChapterId) => {
    setChapterClearSummary(null);
    controllerRef.current?.startChapter(chapterId);
  };

  const handleReplayChapter = (chapterId: ChapterId) => {
    setChapterClearSummary(null);
    controllerRef.current?.startChapter(chapterId);
  };

  // Replay Handlers
  const handleStartCinematicReplay = () => {
    controllerRef.current?.startCinematicReplay();
  };

  const handleExitCinematicReplay = () => {
    controllerRef.current?.stopCinematicReplay();
  };

  const handleToggleReplayPause = () => {
    controllerRef.current?.toggleReplayPause();
  };

  const handleSetReplaySpeed = (speed: number) => {
    controllerRef.current?.setReplaySpeed(speed);
  };

  const handleSetReplayPerspective = (perspective: ReplayCameraPerspective) => {
    controllerRef.current?.setReplayPerspective(perspective);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090e] text-[#f0f6fc]">
      {/* CRT Scanline Filter Overlay */}
      <div className={`crt-overlay ${crtEnabled ? '' : 'disabled'}`} aria-hidden="true" />

      {/* Isolated Three.js WebGL Canvas Mount Container */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* Screen Damage Vignette Flash on Hull Damage */}
      {stats.hull < 30 && gameState === 'PLAYING' && (
        <div className="absolute inset-0 z-1 pointer-events-none bg-red-950/20 shadow-[inset_0_0_80px_rgba(255,0,0,0.4)] animate-pulse" />
      )}

      {/* 1. Title Screen Shell */}
      {gameState === 'TITLE' && (
        <TitleScreen
          onStart={handleStartGame}
          onOpenConsole={() => setIsConsoleOpen(true)}
          onOpenCampaignSelect={() => setIsCampaignSelectOpen(true)}
          campaignProgress={campaignProgress}
          audioMuted={audioMuted}
          onToggleAudio={handleToggleAudio}
          crtEnabled={crtEnabled}
          onToggleCrt={handleToggleCrt}
        />
      )}

      {/* 2. Playing Perimeter HUD (Zero Center Occlusion) */}
      {gameState === 'PLAYING' && (
        <>
          {/* Active Boss Status Gauge (Top-Center) */}
          <BossStatusBar boss={bossLiveState} />

          <PerimeterHud
            stats={stats}
            nodes={nodes}
            onPause={handlePauseGame}
            onOpenConsole={() => setIsConsoleOpen(true)}
            audioMuted={audioMuted}
            onToggleAudio={handleToggleAudio}
            crtEnabled={crtEnabled}
            onToggleCrt={handleToggleCrt}
            cameraMode={cameraMode}
            onToggleCamera={handleToggleCamera}
            onOpenCampaignSelect={() => setIsCampaignSelectOpen(true)}
          />

          <BottomControlDock
            activeTotem={stats.activeTotem}
            onSelectTotem={handleSelectTotem}
            onTriggerPulse={handleTriggerPulse}
            onTriggerHarmonicWave={handleTriggerHarmonicWave}
            onOpenConsole={() => setIsConsoleOpen(true)}
            resonance460k={stats.resonance460k}
            cameraMode={cameraMode}
            onToggleCamera={handleToggleCamera}
          />
        </>
      )}

      {/* 3. Pause / Victory / Game Over Modal */}
      <EndGameModal
        state={gameState}
        stats={stats}
        onResume={handleResumeGame}
        onRestart={handleRestartGame}
        onOpenConsole={() => setIsConsoleOpen(true)}
      />

      {/* 4. Chapter Clear / Sector Liberated Debrief Modal */}
      {gameState === 'CHAPTER_CLEAR' && (
        <ChapterClearModal
          summary={chapterClearSummary}
          onNextChapter={handleNextChapter}
          onReplayChapter={handleReplayChapter}
          onOpenCampaignSelect={() => {
            setChapterClearSummary(null);
            setIsCampaignSelectOpen(true);
          }}
          onStartCinematicReplay={handleStartCinematicReplay}
        />
      )}

      {/* 5. Cinematic Battlefield Replay HUD (Perspective of Destroyed Enemies) */}
      {gameState === 'REPLAY' && (
        <ReplayHud
          replay={replayState}
          onTogglePause={handleToggleReplayPause}
          onSetSpeed={handleSetReplaySpeed}
          onSetPerspective={handleSetReplayPerspective}
          onExitReplay={handleExitCinematicReplay}
        />
      )}

      {/* 6. Campaign Sector Selector Modal */}
      <CampaignSelectModal
        isOpen={isCampaignSelectOpen}
        onClose={() => setIsCampaignSelectOpen(false)}
        onSelectChapter={handleSelectChapter}
        progress={campaignProgress}
        activeChapterId={stats.chapter}
      />

      {/* 7. Complete Tactical Command Core Console Modal (Ctrl+K / Tab) */}
      <TacticalConsoleModal
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        telemetryLogs={telemetryLogs}
        activeTotem={stats.activeTotem}
        onSelectTotem={handleSelectTotem}
        onTriggerPulse={handleTriggerPulse}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
        crtEnabled={crtEnabled}
        onToggleCrt={handleToggleCrt}
        uptimeSeconds={stats.uptimeSeconds}
        pulsesCount={stats.pulsesFired}
      />
    </div>
  );
}
