export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER' | 'CHAPTER_CLEAR' | 'REPLAY';

export type TotemId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface TotemSpec {
  id: TotemId;
  code: string;
  name: string;
  title: string;
  holder: string;
  abilityName: string;
  description: string;
  cooldown: number; // in seconds
  duration: number; // active effect duration in seconds
  color: string;
  laserType: 'overcharge' | 'singularity' | 'aegis' | 'triple' | 'harmonic_chain' | 'hyper_dash' | 'caschi_escort';
}

export interface SovereignNode {
  id: string;
  name: string;
  region: string;
  nodeCount: number;
  spec: string;
  freq: string;
  xRatio: number; // for 2D radar
  yRatio: number;
  x: number; // 3D world space
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  status: 'ONLINE' | 'DEFENDING' | 'CRITICAL';
  color: string;
}

export type EnemyType = 'SWARMER' | 'CORRUPTOR' | 'DISRUPTOR' | 'DREADNOUGHT' | 'BOSS';

export type CameraMode = 'CHASE' | 'BOSS_INTRO' | 'TACTICAL_OVERVIEW' | 'ORBIT' | 'KILL_CAM' | 'REPLAY_FLYTHROUGH';

export type ReplayCameraPerspective = 'ENEMY_POV' | 'CHASE_TRAIL' | 'ORBITAL_SWEEP';

export interface KillRecord {
  id: string;
  position: { x: number; y: number; z: number };
  lookDirection: { x: number; y: number; z: number };
  enemyType: EnemyType;
  enemyName: string;
  timestamp: number;
  fatalTotem: TotemId;
  scoreValue: number;
  isBoss?: boolean;
}

export interface ReplayState {
  active: boolean;
  currentIndex: number;
  totalKills: number;
  progress: number; // 0 to 1
  playbackSpeed: number; // 0.5, 1.0, 2.0
  isPaused: boolean;
  cameraPerspective: ReplayCameraPerspective;
  currentKill: KillRecord | null;
  killHistory: KillRecord[];
}

export interface BossSpec {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  maxHealth: number;
  phases: number;
  color: string;
  accentColor: string;
  abilities: string[];
}

export interface BossLiveState {
  id: string;
  name: string;
  title: string;
  health: number;
  maxHealth: number;
  currentPhase: number;
  totalPhases: number;
  shieldActive: boolean;
  shieldHealth: number;
  maxShield: number;
  telegraphAttack: {
    active: boolean;
    name: string;
    progress: number; // 0 to 1
    targetX: number;
    targetZ: number;
    radius: number;
  } | null;
  isDefeated: boolean;
}

export type ChapterId = 1 | 2 | 3 | 4;

export interface ChapterConfig {
  id: ChapterId;
  code: string;
  title: string;
  subtitle: string;
  sectorName: string;
  threatLevel: string;
  description: string;
  ambientColor: number;
  fogDensity: number;
  realmNodes: string[];
  totalWaves: number;
  boss: BossSpec;
}

export interface ChapterRecord {
  stars: number;
  highScore: number;
  nodesPreserved: number;
  bestTimeSeconds: number;
}

export interface CampaignProgress {
  unlockedChapters: ChapterId[];
  chapterRecords: Record<ChapterId, ChapterRecord>;
}

export interface PlayerStats {
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  score: number;
  multiplier: number;
  resonance460k: number; // 0 - 100
  chapter: ChapterId;
  wave: number;
  totalWavesInChapter: number;
  activeTotem: TotemId;
  pulsesFired: number;
  enemiesDestroyed: number;
  nodesPreserved: number;
  uptimeSeconds: number;
  bossActive: boolean;
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'COMBAT' | 'TOTEM' | 'ALERT' | 'SUCCESS';
}

export interface GameSettings {
  audio: boolean;
  crt: boolean;
  volume: number;
  reducedMotion: boolean;
  cameraMode: CameraMode;
}
