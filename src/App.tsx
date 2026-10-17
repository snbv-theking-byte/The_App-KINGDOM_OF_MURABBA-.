import React, { useEffect, useRef, useState } from 'react';
import { GameController } from './game/GameController';
import { ThreeGameScene } from './game/three/ThreeGameScene';
import { TitleScreen } from './components/TitleScreen';
import { PerimeterHud } from './components/PerimeterHud';
import { BottomControlDock } from './components/BottomControlDock';
import { TacticalConsoleModal } from './components/TacticalConsoleModal';
import { EndGameModal } from './components/EndGameModal';
import { GameState, PlayerStats, SovereignNode, TelemetryLogEntry, TotemId } from './types/game';
import { KEY_RADAR_NODES, TOTEMS } from './data/sovereignData';
import { sound } from './audio/SoundSynth';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<GameController | null>(null);
  const threeSceneRef = useRef<ThreeGameScene | null>(null);

  // React State for UI HUD (updated at throttled intervals from simulation)
  const [gameState, setGameState] = useState<GameState>('TITLE');
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
    wave: 1,
    activeTotem: (localStorage.getItem('snbv_totem') as TotemId) || 'A',
    pulsesFired: 0,
    enemiesDestroyed: 0,
    nodesPreserved: 221,
    uptimeSeconds: 0,
  });

  const [nodes, setNodes] = useState<SovereignNode[]>(KEY_RADAR_NODES);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8) + 'Z',
      message: 'SNBV-CORE] System boot complete. Active Totem: Node A.',
      type: 'INFO',
    },
    {
      id: 'init-2',
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8) + 'Z',
      message: 'ALLIANCE MESH: 221 sovereign realms operational and synchronized.',
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
    controllerRef.current?.startGame();
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

  const handleTriggerPulse = () => {
    if (gameState === 'PLAYING') {
      // Fire double laser pulse
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
          audioMuted={audioMuted}
          onToggleAudio={handleToggleAudio}
          crtEnabled={crtEnabled}
          onToggleCrt={handleToggleCrt}
        />
      )}

      {/* 2. Playing Perimeter HUD (Zero Center Occlusion) */}
      {gameState === 'PLAYING' && (
        <>
          <PerimeterHud
            stats={stats}
            nodes={nodes}
            onPause={handlePauseGame}
            onOpenConsole={() => setIsConsoleOpen(true)}
            audioMuted={audioMuted}
            onToggleAudio={handleToggleAudio}
            crtEnabled={crtEnabled}
            onToggleCrt={handleToggleCrt}
          />

          <BottomControlDock
            activeTotem={stats.activeTotem}
            onSelectTotem={handleSelectTotem}
            onTriggerPulse={handleTriggerPulse}
            onTriggerHarmonicWave={handleTriggerHarmonicWave}
            onOpenConsole={() => setIsConsoleOpen(true)}
            resonance460k={stats.resonance460k}
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

      {/* 4. Complete Tactical Command Core Console Modal (Ctrl+K / Tab) */}
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
