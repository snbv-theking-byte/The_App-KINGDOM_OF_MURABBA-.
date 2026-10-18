import * as THREE from 'three';
import { sound } from '../audio/SoundSynth';
import { KEY_RADAR_NODES, TOTEMS } from '../data/sovereignData';
import { CAMPAIGN_CHAPTERS, recordChapterCompletion } from '../data/campaignData';
import { MANIFESTO_CONFIG } from '../data/manifestoData';
import {
  BossLiveState,
  CameraMode,
  ChapterConfig,
  ChapterId,
  EnemyType,
  GameState,
  KillRecord,
  PlayerStats,
  ReplayCameraPerspective,
  ReplayState,
  SovereignNode,
  TelemetryLogEntry,
  TotemId,
} from '../types/game';
import { EnemyActor, ThreeGameScene } from './three/ThreeGameScene';

export interface GameCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onStateChange: (state: GameState) => void;
  onLogTelemetry: (entry: TelemetryLogEntry) => void;
  onNodesUpdate: (nodes: SovereignNode[]) => void;
  onBossUpdate: (boss: BossLiveState | null) => void;
  onChapterComplete: (summary: {
    chapter: ChapterConfig;
    stars: number;
    newlyUnlocked: ChapterId | null;
    score: number;
    timeSeconds: number;
    nodesPreserved: number;
  }) => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onReplayUpdate?: (replay: ReplayState) => void;
}

export class GameController {
  private threeScene: ThreeGameScene;
  private callbacks: GameCallbacks;

  public state: GameState = 'TITLE';
  public currentChapterId: ChapterId = 1;

  // Player Kinematics
  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerTargetRotationZ = 0;
  private fireCooldown = 0;
  private totemActiveTime = 0;

  // Stats
  public stats: PlayerStats = {
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
    activeTotem: 'A',
    pulsesFired: 0,
    enemiesDestroyed: 0,
    nodesPreserved: 221,
    uptimeSeconds: 0,
    bossActive: false,
  };

  // Sovereign Nodes
  public nodes: SovereignNode[] = JSON.parse(JSON.stringify(KEY_RADAR_NODES));

  // Boss Combat System
  public bossActor: EnemyActor | null = null;
  public bossLiveState: BossLiveState | null = null;
  private bossTelegraphTimer = 0;
  private bossTelegraphDuration = 2.0;
  private bossTelegraphTarget = new THREE.Vector3(0, 0, 0);
  private bossAttackCooldown = 3.0;

  // Cinematic Replay System & Kill History Recording
  public killHistory: KillRecord[] = [];
  public replayPerspective: ReplayCameraPerspective = 'ENEMY_POV';
  public replaySpeed = 1.0;
  public isReplayPaused = false;

  // Input Handling
  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private isPointerDown = false;
  private pointerWorldPos = new THREE.Vector3(0, 0, 0);
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();

  // Wave & Spawn Timers
  private spawnTimer = 0;
  private waveClearTimer = 0;
  private enemiesRemainingToSpawn = 0;
  private bossSpawned = false;

  // Animation Loop variables
  private lastTime = 0;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private telemetryTimer = 0;

  constructor(threeScene: ThreeGameScene, callbacks: GameCallbacks) {
    this.threeScene = threeScene;
    this.callbacks = callbacks;

    this.setupInputs();
    this.startLoop();
  }

  private setupInputs() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

    const dom = this.threeScene.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (this.state === 'PLAYING') {
        e.preventDefault();
      }
    }

    if (!this.heldKeys.has(e.code)) {
      this.justPressedKeys.add(e.code);
    }
    this.heldKeys.add(e.code);

    // Instant Hotkey Controls
    if (this.state === 'TITLE') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.startChapter(this.currentChapterId);
      }
    } else if (this.state === 'PLAYING') {
      if (e.code === 'Escape') {
        this.pauseGame();
      }

      if (e.code === 'KeyC') {
        this.toggleCameraMode();
      }

      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].includes(e.code)) {
        const idMap: Record<string, TotemId> = {
          Digit1: 'A',
          Digit2: 'B',
          Digit3: 'C',
          Digit4: 'D',
          Digit5: 'E',
          Digit6: 'F',
          Digit7: 'G',
        };
        const id = idMap[e.code];
        if (id) this.switchTotem(id);
      }

      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        this.triggerPhiHarmonicWave();
      }
    } else if (this.state === 'REPLAY') {
      if (e.code === 'KeyV') {
        // Toggle Replay Camera Perspective
        const nextPerspective: ReplayCameraPerspective =
          this.replayPerspective === 'ENEMY_POV'
            ? 'CHASE_TRAIL'
            : this.replayPerspective === 'CHASE_TRAIL'
            ? 'ORBITAL_SWEEP'
            : 'ENEMY_POV';
        this.setReplayPerspective(nextPerspective);
      }
      if (e.code === 'Space') {
        this.toggleReplayPause();
      }
      if (e.code === 'Escape') {
        this.stopCinematicReplay();
      }
    } else if (this.state === 'PAUSED') {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        this.resumeGame();
      }
    } else if (this.state === 'GAME_OVER') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.restartGame();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleWindowBlur = () => {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    this.isPointerDown = false;
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button === 0) {
      this.isPointerDown = true;
      this.updatePointerWorld(e.clientX, e.clientY);
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.updatePointerWorld(e.clientX, e.clientY);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      this.isPointerDown = false;
    }
  };

  private updatePointerWorld(cx: number, cy: number) {
    const rect = this.threeScene.renderer.domElement.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * 2 - 1;
    const y = -((cy - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.threeScene.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.pointerWorldPos);
  }

  private handleVisibilityChange = () => {
    if (document.hidden && this.state === 'PLAYING') {
      this.pauseGame();
    }
  };

  public toggleCameraMode() {
    const nextMode: CameraMode =
      this.threeScene.cameraMode === 'CHASE' ? 'TACTICAL_OVERVIEW' : 'CHASE';
    this.threeScene.setCameraMode(nextMode);
    sound.playClick();
    this.callbacks.onCameraModeChange(nextMode);
    this.logTelemetry(`TACTICAL CAMERA: Switched view to ${nextMode}.`, 'INFO');
  }

  public setCameraMode(mode: CameraMode) {
    this.threeScene.setCameraMode(mode);
    this.callbacks.onCameraModeChange(mode);
  }

  // Cinematic Replay Controls
  public startCinematicReplay() {
    if (this.killHistory.length === 0) {
      this.logTelemetry('REPLAY UNAVAILABLE: No battlefield death vectors recorded.', 'ALERT');
      return;
    }

    this.state = 'REPLAY';
    this.isReplayPaused = false;
    this.threeScene.replayPerspective = this.replayPerspective;
    this.threeScene.replaySpeed = this.replaySpeed;
    this.threeScene.startReplayFlythrough(this.killHistory);

    sound.playClick();
    this.callbacks.onStateChange('REPLAY');
    this.logTelemetry(`CINEMATIC REPLAY ENGAGED: Sweeping flythrough across ${this.killHistory.length} enemy kill vectors!`, 'SUCCESS');
    this.dispatchReplayState();
  }

  public stopCinematicReplay() {
    this.state = 'CHAPTER_CLEAR';
    this.threeScene.stopReplay();
    sound.playClick();
    this.callbacks.onStateChange('CHAPTER_CLEAR');
    this.logTelemetry('CINEMATIC REPLAY: Exited. Returned to Sector Debrief.', 'INFO');
  }

  public setReplayPerspective(perspective: ReplayCameraPerspective) {
    this.replayPerspective = perspective;
    this.threeScene.replayPerspective = perspective;
    sound.playClick();
    this.logTelemetry(`REPLAY PERSPECTIVE: Set to ${perspective}.`, 'INFO');
    this.dispatchReplayState();
  }

  public setReplaySpeed(speed: number) {
    this.replaySpeed = speed;
    this.threeScene.replaySpeed = speed;
    sound.playClick();
    this.dispatchReplayState();
  }

  public toggleReplayPause() {
    this.isReplayPaused = !this.isReplayPaused;
    sound.playClick();
    this.dispatchReplayState();
  }

  private dispatchReplayState() {
    if (this.callbacks.onReplayUpdate) {
      const totalKills = this.killHistory.length;
      const duration = totalKills * 2.4;
      const progress = duration > 0 ? (this.threeScene.replayTime % duration) / duration : 0;
      const currentIndex = Math.min(totalKills - 1, Math.floor(progress * totalKills));

      this.callbacks.onReplayUpdate({
        active: this.state === 'REPLAY',
        currentIndex,
        totalKills,
        progress,
        playbackSpeed: this.replaySpeed,
        isPaused: this.isReplayPaused,
        cameraPerspective: this.replayPerspective,
        currentKill: this.killHistory[currentIndex] || null,
        killHistory: this.killHistory,
      });
    }
  }

  public startChapter(chapterId: ChapterId) {
    this.currentChapterId = chapterId;
    const chapter = CAMPAIGN_CHAPTERS[chapterId];

    this.clearAllEntities();
    this.killHistory = []; // Reset kill history for fresh chapter recording

    this.state = 'PLAYING';
    this.stats.hull = 100;
    this.stats.shield = 100;
    this.stats.chapter = chapterId;
    this.stats.wave = 1;
    this.stats.totalWavesInChapter = chapter.totalWaves;
    this.stats.bossActive = false;
    this.stats.score = 0;
    this.stats.multiplier = 1.0;
    this.stats.resonance460k = 25;
    this.stats.uptimeSeconds = 0;

    this.playerPos.set(0, 0, 0);
    this.playerVel.set(0, 0, 0);

    this.threeScene.applyChapterAtmosphere(chapter.ambientColor, chapter.fogDensity);

    this.nodes = JSON.parse(JSON.stringify(KEY_RADAR_NODES));
    this.callbacks.onNodesUpdate(this.nodes);

    this.bossActor = null;
    this.bossLiveState = null;
    this.callbacks.onBossUpdate(null);

    this.startWave(1);
    this.callbacks.onStateChange(this.state);
    this.callbacks.onStatsUpdate({ ...this.stats });

    sound.playTotemActivate();
    this.logTelemetry(`MANIFESTO CODEX [${MANIFESTO_CONFIG.identity.token}]: ${MANIFESTO_CONFIG.symbolism.formula}`, 'INFO');
    this.logTelemetry(`CAMPAIGN DEPLOYMENT: ${chapter.code} - ${chapter.title} initialized.`, 'SUCCESS');
    this.logTelemetry(`SECTOR INTEL: ${chapter.sectorName} // Threat: ${chapter.threatLevel}`, 'INFO');
  }

  public startGame() {
    this.startChapter(this.currentChapterId);
  }

  public pauseGame() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.callbacks.onStateChange(this.state);
      sound.playClick();
      this.logTelemetry('TACTICAL PAUSE: Command simulation suspended.', 'INFO');
    }
  }

  public resumeGame() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.callbacks.onStateChange(this.state);
      sound.playClick();
      this.logTelemetry('TACTICAL RESUME: Command simulation active.', 'INFO');
    }
  }

  public restartGame() {
    this.clearAllEntities();
    this.killHistory = [];
    this.startChapter(this.currentChapterId);
  }

  private clearAllEntities() {
    this.threeScene.enemies.forEach(e => this.threeScene.scene.remove(e.group));
    this.threeScene.enemies = [];
    this.threeScene.lasers.forEach(l => {
      this.threeScene.scene.remove(l.mesh);
      l.mesh.geometry.dispose();
      (l.mesh.material as THREE.Material).dispose();
    });
    this.threeScene.lasers = [];
    this.threeScene.crystals.forEach(c => {
      this.threeScene.scene.remove(c.mesh);
      (c.mesh.material as THREE.Material).dispose();
    });
    this.threeScene.crystals = [];
    this.threeScene.activeBoss = null;
    this.threeScene.telegraphGroup.visible = false;
    this.bossActor = null;
    this.bossLiveState = null;
  }

  public switchTotem(id: TotemId) {
    if (this.stats.activeTotem === id) return;
    this.stats.activeTotem = id;
    const totem = TOTEMS[id];
    this.totemActiveTime = totem.duration;

    sound.playTotemActivate();
    this.threeScene.spawnExplosion(this.playerPos, new THREE.Color(totem.color).getHex(), 18);
    this.logTelemetry(`TOTEM ACTIVATION [${totem.code}]: ${totem.name} (${totem.abilityName})`, 'TOTEM');

    if (id === 'F') {
      sound.playDash();
      this.playerVel.z -= 38;
      this.threeScene.addScreenShake(0.8);
      this.threeScene.spawnExplosion(this.playerPos, 0x00ffff, 30);
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  public triggerPhiHarmonicWave() {
    if (this.stats.resonance460k < 100) {
      sound.playClick();
      this.logTelemetry('HARMONIC WAVE: 460,000E resonance insufficient. Collect more shards.', 'ALERT');
      return;
    }

    this.stats.resonance460k = 0;
    sound.playPhiHarmonicWave();
    this.threeScene.addScreenShake(1.8);
    this.threeScene.triggerHitstop(80);

    this.threeScene.spawnVolumetricShockwave(this.playerPos, 0xffd978, 80, 25.0);

    this.threeScene.enemies.forEach(enemy => {
      if (enemy.isBoss) {
        enemy.health -= 250;
        this.threeScene.spawnExplosion(enemy.position, 0xffd978, 30);
      } else {
        enemy.health -= 180;
        this.threeScene.spawnExplosion(enemy.position, 0xffd978, 20);
      }
    });

    this.logTelemetry('HARMONIC DISCHARGE: Golden Ratio (Φ = 1.618) wave cleared all vector sectors!', 'SUCCESS');
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private startWave(waveNum: number) {
    this.stats.wave = waveNum;
    this.bossSpawned = false;
    const chapter = CAMPAIGN_CHAPTERS[this.currentChapterId];

    if (waveNum === chapter.totalWaves) {
      this.enemiesRemainingToSpawn = 4;
      this.stats.bossActive = true;
      this.logTelemetry(`CRITICAL ALARM: Final Wave ${waveNum}/${chapter.totalWaves} - Sovereign Titan signature detected!`, 'ALERT');
      sound.playBossWarning();
      setTimeout(() => {
        if (this.state === 'PLAYING' && !this.bossSpawned) {
          this.spawnChapterBoss();
        }
      }, 1800);
    } else {
      this.enemiesRemainingToSpawn = 7 + waveNum * 4;
      this.stats.bossActive = false;
      this.logTelemetry(`TACTICAL INCOMING: Wave ${waveNum}/${chapter.totalWaves} advancing. Defense grid alert.`, 'ALERT');
    }

    this.spawnTimer = 1.0;
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private spawnChapterBoss() {
    this.bossSpawned = true;
    this.stats.bossActive = true;
    const chapter = CAMPAIGN_CHAPTERS[this.currentChapterId];
    const bossSpec = chapter.boss;

    const spawnPos = new THREE.Vector3(0, 2.0, -38);
    const boss = this.threeScene.spawnBossTitan(this.currentChapterId, bossSpec, spawnPos);
    this.bossActor = boss;

    this.bossLiveState = {
      id: bossSpec.id,
      name: bossSpec.name,
      title: bossSpec.title,
      health: bossSpec.maxHealth,
      maxHealth: bossSpec.maxHealth,
      currentPhase: 1,
      totalPhases: bossSpec.phases,
      shieldActive: false,
      shieldHealth: 0,
      maxShield: Math.round(bossSpec.maxHealth * 0.3),
      telegraphAttack: null,
      isDefeated: false,
    };

    sound.playBossWarning();
    this.logTelemetry(`BOSS ENGAGED: ${bossSpec.title} has entered operational arena!`, 'ALERT');
    this.callbacks.onBossUpdate(this.bossLiveState);
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private startLoop() {
    this.isRunning = true;
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.isRunning) return;

      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (this.state === 'PLAYING') {
        this.updateSimulation(dt);
      } else if (this.state === 'REPLAY') {
        this.dispatchReplayState();
      }

      this.threeScene.update(
        dt,
        this.state,
        this.stats.activeTotem,
        this.playerPos
      );

      this.justPressedKeys.clear();
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private updateSimulation(dt: number) {
    this.stats.uptimeSeconds += dt;
    this.telemetryTimer += dt;

    // 1. Natural Shield Regeneration
    if (this.stats.shield < this.stats.maxShield) {
      this.stats.shield = Math.min(this.stats.maxShield, this.stats.shield + dt * 4.5);
    }

    // 2. Player Input Kinematics
    let moveX = 0;
    let moveZ = 0;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveZ -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveZ += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveX += 1;

    if (moveX !== 0 && moveZ !== 0) {
      moveX *= 0.7071;
      moveZ *= 0.7071;
    }

    const accel = 90.0;
    const maxSpeed = this.stats.activeTotem === 'F' ? 44.0 : 28.0;

    this.playerVel.x += moveX * accel * dt;
    this.playerVel.z += moveZ * accel * dt;

    this.playerVel.multiplyScalar(Math.exp(-dt * 6.5));
    this.playerPos.addScaledVector(this.playerVel, dt);

    const arenaRadius = 45;
    if (this.playerPos.length() > arenaRadius) {
      this.playerPos.clampLength(0, arenaRadius);
    }

    this.playerTargetRotationZ = -this.playerVel.x * 0.035;
    this.threeScene.playerShip.position.copy(this.playerPos);
    this.threeScene.playerShip.position.y = 1.0;
    this.threeScene.playerShip.rotation.z = THREE.MathUtils.damp(
      this.threeScene.playerShip.rotation.z,
      this.playerTargetRotationZ,
      12,
      dt
    );

    // 3. Firing Lasers
    this.fireCooldown -= dt;
    const wantsFire = this.heldKeys.has('Space') || this.isPointerDown;
    if (wantsFire && this.fireCooldown <= 0) {
      this.executePlayerFire();
    }

    // 4. Enemy Spawning & Waves
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemiesRemainingToSpawn > 0) {
      this.spawnNextEnemy();
      this.spawnTimer = Math.max(0.7, 2.4 - this.stats.wave * 0.2);
    }

    // 5. Boss Mechanics Update
    if (this.bossActor && this.bossLiveState && !this.bossLiveState.isDefeated) {
      this.updateBossBehavior(dt);
    }

    // 6. Wave Completion / Chapter Clear Check
    const chapter = CAMPAIGN_CHAPTERS[this.currentChapterId];
    if (this.enemiesRemainingToSpawn <= 0 && this.threeScene.enemies.length === 0) {
      this.waveClearTimer += dt;
      if (this.waveClearTimer > 1.8) {
        this.waveClearTimer = 0;

        if (this.stats.wave >= chapter.totalWaves) {
          this.handleChapterVictory();
        } else {
          this.stats.score += 2500 * this.stats.wave;
          this.stats.resonance460k = Math.min(100, this.stats.resonance460k + 35);
          sound.playTotemActivate();
          this.logTelemetry(`WAVE ${this.stats.wave} SECURED! All tactical hostiles eliminated.`, 'SUCCESS');
          this.startWave(this.stats.wave + 1);
        }
      }
    }

    // 7. Update Standard Enemies & AI
    this.updateEnemies(dt);

    // 8. Laser Collision Detection
    this.checkLaserCollisions();

    // 9. Crystal Collection
    this.checkCrystalCollections();

    // 10. UI Telemetry Updates
    if (this.telemetryTimer > 0.15) {
      this.telemetryTimer = 0;
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onNodesUpdate([...this.nodes]);
      if (this.bossLiveState) {
        this.callbacks.onBossUpdate({ ...this.bossLiveState });
      }
    }
  }

  private updateBossBehavior(dt: number) {
    if (!this.bossActor || !this.bossLiveState) return;

    const boss = this.bossActor;
    const playerP = this.playerPos;

    const targetZ = playerP.z - 22;
    const targetX = playerP.x * 0.7;

    boss.position.x = THREE.MathUtils.damp(boss.position.x, targetX, 1.8, dt);
    boss.position.z = THREE.MathUtils.damp(boss.position.z, targetZ, 1.5, dt);
    boss.group.position.copy(boss.position);

    this.bossLiveState.health = Math.max(0, boss.health);

    const hpRatio = boss.health / boss.maxHealth;
    const totalPhases = this.bossLiveState.totalPhases;

    if (totalPhases === 2) {
      if (hpRatio <= 0.5 && this.bossLiveState.currentPhase === 1) {
        this.transitionBossPhase(2);
      }
    } else if (totalPhases === 3) {
      if (hpRatio <= 0.66 && this.bossLiveState.currentPhase === 1) {
        this.transitionBossPhase(2);
      } else if (hpRatio <= 0.33 && this.bossLiveState.currentPhase === 2) {
        this.transitionBossPhase(3);
      }
    }

    this.bossAttackCooldown -= dt;
    if (this.bossAttackCooldown <= 0) {
      this.executeBossAttack();
      this.bossAttackCooldown = Math.max(1.5, 3.8 - this.bossLiveState.currentPhase * 0.6);
    }

    if (this.bossLiveState.telegraphAttack && this.bossLiveState.telegraphAttack.active) {
      this.bossTelegraphTimer += dt;
      const progress = Math.min(1.0, this.bossTelegraphTimer / this.bossTelegraphDuration);
      this.bossLiveState.telegraphAttack.progress = progress;

      this.threeScene.updateTelegraphReticle(this.bossLiveState.telegraphAttack);

      if (progress >= 1.0) {
        this.detonateTelegraphedAttack();
        this.bossLiveState.telegraphAttack.active = false;
        this.threeScene.updateTelegraphReticle(null);
      }
    }
  }

  private transitionBossPhase(newPhase: number) {
    if (!this.bossActor || !this.bossLiveState) return;
    this.bossLiveState.currentPhase = newPhase;
    this.bossActor.bossPhase = newPhase;

    sound.playBossPhaseShift();
    this.threeScene.addScreenShake(1.6);
    this.threeScene.spawnVolumetricShockwave(this.bossActor.position, 0xff3366, 60, 14.0);

    this.bossLiveState.shieldActive = true;
    this.bossLiveState.shieldHealth = this.bossLiveState.maxShield;
    this.bossActor.bossShieldActive = true;

    this.logTelemetry(`BOSS PHASE SHIFT: Phase ${newPhase} triggered! Deflector shields & orbital artillery armed!`, 'ALERT');
    this.callbacks.onBossUpdate({ ...this.bossLiveState });
  }

  private executeBossAttack() {
    if (!this.bossActor || !this.bossLiveState) return;

    const bossPos = this.bossActor.position;
    const playerPos = this.playerPos;
    const phase = this.bossLiveState.currentPhase;

    const roll = Math.random();

    if (roll < 0.45) {
      const forward = new THREE.Vector3().subVectors(playerPos, bossPos).normalize();
      sound.playLaser(true);
      this.threeScene.fireLaser(bossPos.clone().add(new THREE.Vector3(0, 0, 2)), forward, true, '#ff3366', 22);

      const leftF = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.2);
      const rightF = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.2);
      this.threeScene.fireLaser(bossPos.clone().add(new THREE.Vector3(-2.5, 0, 1)), leftF, true, '#ff3366', 20);
      this.threeScene.fireLaser(bossPos.clone().add(new THREE.Vector3(2.5, 0, 1)), rightF, true, '#ff3366', 20);
    } else if (roll < 0.8 && phase >= 2) {
      this.bossTelegraphTimer = 0;
      this.bossTelegraphDuration = 2.0;
      this.bossTelegraphTarget.copy(playerPos);

      this.bossLiveState.telegraphAttack = {
        active: true,
        name: 'Orbital Annihilation Lance',
        progress: 0,
        targetX: playerPos.x,
        targetZ: playerPos.z,
        radius: 4.5,
      };

      sound.playNodeAlert();
      this.logTelemetry('WARNING: Orbital trajectory locked! Evade targeted blast vector!', 'ALERT');
    } else {
      const count = phase >= 3 ? 12 : 8;
      sound.playLaser(true);
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / count;
        const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        this.threeScene.fireLaser(bossPos, dir, true, '#ff9e00', 16);
      }
    }
  }

  private detonateTelegraphedAttack() {
    if (!this.bossLiveState || !this.bossLiveState.telegraphAttack) return;

    const { targetX, targetZ, radius } = this.bossLiveState.telegraphAttack;
    const impactPos = new THREE.Vector3(targetX, 0, targetZ);

    sound.playHeavyImpact();
    this.threeScene.addScreenShake(1.5);
    this.threeScene.spawnVolumetricShockwave(impactPos, 0xff0055, 60, radius * 2.2);

    const dist = this.playerPos.distanceTo(impactPos);
    if (dist < radius) {
      this.takeDamage(45);
      this.logTelemetry('DIRECT HIT: Incurred damage from orbital kinetic impact!', 'ALERT');
    }
  }

  private executePlayerFire() {
    const isTotemA = this.stats.activeTotem === 'A';
    const isTotemD = this.stats.activeTotem === 'D';
    this.fireCooldown = isTotemA ? 0.11 : 0.17;
    this.stats.pulsesFired += 1;

    sound.playLaser(isTotemA);
    this.threeScene.addScreenShake(isTotemA ? 0.22 : 0.1);

    const forward = new THREE.Vector3(0, 0, -1);
    const originL = this.playerPos.clone().add(new THREE.Vector3(-1.1, 1.0, -1.0));
    const originR = this.playerPos.clone().add(new THREE.Vector3(1.1, 1.0, -1.0));

    const color = isTotemA ? '#ffd978' : isTotemD ? '#ff9e00' : '#00f0ff';
    const damage = isTotemA ? 45 : 28;

    this.threeScene.fireLaser(originL, forward, false, color, damage);
    this.threeScene.fireLaser(originR, forward, false, color, damage);

    if (isTotemD) {
      const leftDir = new THREE.Vector3(-0.35, 0, -0.93).normalize();
      const rightDir = new THREE.Vector3(0.35, 0, -0.93).normalize();
      this.threeScene.fireLaser(originL, leftDir, false, '#ff9e00', 28);
      this.threeScene.fireLaser(originR, rightDir, false, '#ff9e00', 28);
    }
  }

  private spawnNextEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 48 + Math.random() * 8;
    const pos = new THREE.Vector3(Math.cos(angle) * spawnDist, 1.2, Math.sin(angle) * spawnDist);

    let type: EnemyType = 'SWARMER';
    const r = Math.random();
    if (this.stats.wave >= 2 && r > 0.55) {
      type = 'CORRUPTOR';
    } else if (this.stats.wave >= 3 && r > 0.35) {
      type = 'DISRUPTOR';
    }

    const targetNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    this.threeScene.spawnEnemy(type, pos, targetNode?.id || null);
    this.enemiesRemainingToSpawn--;
  }

  private updateEnemies(dt: number) {
    const playerPosition = this.playerPos;

    for (let i = this.threeScene.enemies.length - 1; i >= 0; i--) {
      const enemy = this.threeScene.enemies[i];
      if (enemy.isBoss) continue;

      enemy.fireTimer -= dt;

      let targetPos = playerPosition;
      if (enemy.targetNodeId && Math.random() > 0.4) {
        const node = this.nodes.find(n => n.id === enemy.targetNodeId);
        if (node && node.status !== 'CRITICAL') {
          targetPos = new THREE.Vector3(node.x, 0, node.z);
        }
      }

      const dirToTarget = new THREE.Vector3().subVectors(targetPos, enemy.position).normalize();
      const moveSpeed = enemy.type === 'SWARMER' ? 14 : enemy.type === 'CORRUPTOR' ? 8 : 10;

      enemy.velocity.copy(dirToTarget).multiplyScalar(moveSpeed);
      enemy.position.addScaledVector(enemy.velocity, dt);
      enemy.group.lookAt(targetPos.x, enemy.position.y, targetPos.z);

      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = enemy.type === 'CORRUPTOR' ? 2.5 : 1.8;
        const shootDir = new THREE.Vector3().subVectors(playerPosition, enemy.position).normalize();
        this.threeScene.fireLaser(enemy.position, shootDir, true, '#ff3366', 15);
      }

      const distToPlayer = enemy.position.distanceTo(playerPosition);
      if (distToPlayer < enemy.radius + 1.4) {
        this.takeDamage(enemy.type === 'CORRUPTOR' ? 30 : 15);
        enemy.health -= 35;
        this.threeScene.spawnExplosion(enemy.position, 0xff3366, 14);
      }
    }
  }

  private checkLaserCollisions() {
    for (let l = this.threeScene.lasers.length - 1; l >= 0; l--) {
      const laser = this.threeScene.lasers[l];

      if (laser.isEnemy) {
        const distToPlayer = laser.position.distanceTo(this.playerPos);
        if (distToPlayer < 2.0) {
          this.takeDamage(laser.damage);
          this.removeLaser(l);
          continue;
        }

        for (const node of this.nodes) {
          const distToNode = laser.position.distanceTo(new THREE.Vector3(node.x, 0, node.z));
          if (distToNode < 2.4 && node.health > 0) {
            node.health = Math.max(0, node.health - laser.damage);
            if (node.health <= 0 && node.status !== 'CRITICAL') {
              node.status = 'CRITICAL';
              this.stats.nodesPreserved = Math.max(0, this.stats.nodesPreserved - 1);
              sound.playNodeAlert();
              this.logTelemetry(`PERIMETER BREACH: Node ${node.name} status degraded to CRITICAL!`, 'ALERT');
            }
            this.removeLaser(l);
            break;
          }
        }
      } else {
        for (let e = this.threeScene.enemies.length - 1; e >= 0; e--) {
          const enemy = this.threeScene.enemies[e];
          const dist = laser.position.distanceTo(enemy.position);

          if (dist < enemy.radius) {
            this.removeLaser(l);

            if (enemy.isBoss && this.bossLiveState) {
              if (this.bossLiveState.shieldActive && this.bossLiveState.shieldHealth > 0) {
                this.bossLiveState.shieldHealth -= laser.damage;
                sound.playShieldDeflect();
                this.threeScene.spawnExplosion(laser.position, 0x00f0ff, 12);
                if (this.bossLiveState.shieldHealth <= 0) {
                  this.bossLiveState.shieldActive = false;
                  enemy.bossShieldActive = false;
                  this.logTelemetry('SHIELD SHATTERED: Boss deflector ward collapsed! Direct hull vulnerability!', 'SUCCESS');
                  sound.playHeavyImpact();
                  this.threeScene.spawnVolumetricShockwave(enemy.position, 0x00f0ff, 40, 8.0);
                }
              } else {
                enemy.health -= laser.damage;
                sound.playHeavyImpact();
                this.threeScene.spawnExplosion(laser.position, 0xffd978, 14);
              }

              this.bossLiveState.health = Math.max(0, enemy.health);
              this.callbacks.onBossUpdate({ ...this.bossLiveState });

              if (enemy.health <= 0) {
                this.destroyBoss(e);
              }
            } else {
              enemy.health -= laser.damage;
              sound.playHeavyImpact();
              this.threeScene.spawnExplosion(laser.position, 0xffd978, 10);

              if (enemy.health <= 0) {
                this.destroyEnemy(e);
              }
            }
            break;
          }
        }
      }
    }
  }

  private destroyEnemy(idx: number) {
    const enemy = this.threeScene.enemies[idx];
    this.threeScene.spawnExplosion(enemy.position, 0xff3366, 24);
    this.stats.enemiesDestroyed += 1;
    this.stats.score += enemy.scoreValue * this.stats.multiplier;
    this.stats.multiplier = Math.min(4.0, this.stats.multiplier + 0.1);

    // Record Kill for Cinematic Replay
    const lookDir = new THREE.Vector3().subVectors(this.playerPos, enemy.position).normalize();
    this.killHistory.push({
      id: enemy.id,
      position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
      lookDirection: { x: lookDir.x, y: lookDir.y, z: lookDir.z },
      enemyType: enemy.type,
      enemyName: `${enemy.type} INTERCEPTOR`,
      timestamp: Date.now(),
      fatalTotem: this.stats.activeTotem,
      scoreValue: enemy.scoreValue,
      isBoss: false,
    });

    const shardCount = enemy.type === 'CORRUPTOR' ? 3 : 1;
    for (let s = 0; s < shardCount; s++) {
      this.threeScene.spawnCrystalShard(enemy.position, 15);
    }

    this.threeScene.scene.remove(enemy.group);
    this.threeScene.enemies.splice(idx, 1);
  }

  private destroyBoss(idx: number) {
    const boss = this.threeScene.enemies[idx];
    if (this.bossLiveState) {
      this.bossLiveState.isDefeated = true;
      this.bossLiveState.health = 0;
      this.callbacks.onBossUpdate({ ...this.bossLiveState });
    }

    sound.playBossDefeated();
    this.threeScene.triggerBossKillCam(boss.position);

    // Record Boss Kill for Cinematic Replay
    const lookDir = new THREE.Vector3().subVectors(this.playerPos, boss.position).normalize();
    this.killHistory.push({
      id: boss.id,
      position: { x: boss.position.x, y: boss.position.y, z: boss.position.z },
      lookDirection: { x: lookDir.x, y: lookDir.y, z: lookDir.z },
      enemyType: 'BOSS',
      enemyName: boss.bossSpec?.title || 'SOVEREIGN TITAN OVERLORD',
      timestamp: Date.now(),
      fatalTotem: this.stats.activeTotem,
      scoreValue: boss.scoreValue,
      isBoss: true,
    });

    this.stats.score += boss.scoreValue * this.stats.multiplier;
    this.stats.enemiesDestroyed += 1;
    this.stats.resonance460k = 100;

    for (let i = 0; i < 12; i++) {
      this.threeScene.spawnCrystalShard(boss.position, 25);
    }

    this.logTelemetry(`SOVEREIGN TRIUMPH: ${boss.bossSpec?.title || 'Boss'} ANNIHILATED! Sector Secured!`, 'SUCCESS');

    this.threeScene.scene.remove(boss.group);
    this.threeScene.enemies.splice(idx, 1);
    this.bossActor = null;
    this.stats.bossActive = false;
  }

  private handleChapterVictory() {
    this.state = 'CHAPTER_CLEAR';
    sound.playChapterComplete();
    const chapter = CAMPAIGN_CHAPTERS[this.currentChapterId];

    const { progress, newlyUnlocked, starsEarned } = recordChapterCompletion(
      this.currentChapterId,
      this.stats.score,
      this.stats.nodesPreserved,
      Math.round(this.stats.uptimeSeconds)
    );

    this.callbacks.onStateChange('CHAPTER_CLEAR');
    this.callbacks.onChapterComplete({
      chapter,
      stars: starsEarned,
      newlyUnlocked,
      score: this.stats.score,
      timeSeconds: Math.round(this.stats.uptimeSeconds),
      nodesPreserved: this.stats.nodesPreserved,
    });
  }

  private checkCrystalCollections() {
    for (let i = this.threeScene.crystals.length - 1; i >= 0; i--) {
      const crystal = this.threeScene.crystals[i];
      const dist = crystal.position.distanceTo(this.playerPos);

      if (dist < 2.2) {
        sound.playCrystalCollect();
        this.stats.resonance460k = Math.min(100, this.stats.resonance460k + crystal.value * 0.4);
        this.stats.score += 250;
        this.threeScene.spawnExplosion(crystal.position, 0xdfb15b, 8);

        this.threeScene.scene.remove(crystal.mesh);
        (crystal.mesh.material as THREE.Material).dispose();
        this.threeScene.crystals.splice(i, 1);
      }
    }
  }

  private removeLaser(idx: number) {
    const laser = this.threeScene.lasers[idx];
    if (laser) {
      this.threeScene.scene.remove(laser.mesh);
      laser.mesh.geometry.dispose();
      (laser.mesh.material as THREE.Material).dispose();
      this.threeScene.lasers.splice(idx, 1);
    }
  }

  public takeDamage(amount: number) {
    if (this.stats.activeTotem === 'C') {
      sound.playShieldDeflect();
      this.threeScene.spawnExplosion(this.playerPos, 0x00f0ff, 14);
      return;
    }

    sound.playHeavyImpact();
    this.threeScene.addScreenShake(0.65);
    this.threeScene.triggerHitstop(40);
    this.stats.multiplier = 1.0;

    if (this.stats.shield > 0) {
      const absorb = Math.min(this.stats.shield, amount);
      this.stats.shield -= absorb;
      amount -= absorb;
      sound.playShieldDeflect();
    }

    if (amount > 0) {
      this.stats.hull = Math.max(0, this.stats.hull - amount);
      if (this.stats.hull <= 0) {
        this.handleGameOver();
      }
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private handleGameOver() {
    this.state = 'GAME_OVER';
    sound.playHeavyImpact();
    this.threeScene.spawnVolumetricShockwave(this.playerPos, 0xff0055, 70, 15.0);
    this.callbacks.onStateChange('GAME_OVER');
    this.logTelemetry('CRITICAL BREACH: Mukaab Core Defense destroyed. Simulation Terminated.', 'ALERT');
  }

  private logTelemetry(message: string, type: TelemetryLogEntry['type']) {
    const entry: TelemetryLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8) + 'Z',
      message,
      type,
    };
    this.callbacks.onLogTelemetry(entry);
  }

  public dispose() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
