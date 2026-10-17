export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

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

export type EnemyType = 'SWARMER' | 'CORRUPTOR' | 'DISRUPTOR' | 'DREADNOUGHT';

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
  wave: number;
  activeTotem: TotemId;
  pulsesFired: number;
  enemiesDestroyed: number;
  nodesPreserved: number;
  uptimeSeconds: number;
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
}
