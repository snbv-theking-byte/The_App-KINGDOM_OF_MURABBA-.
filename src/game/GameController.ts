import * as THREE from 'three';
import { sound } from '../audio/SoundSynth';
import { KEY_RADAR_NODES, TOTEMS } from '../data/sovereignData';
import { EnemyType, GameState, PlayerStats, SovereignNode, TelemetryLogEntry, TotemId } from '../types/game';
import { EnemyActor, ThreeGameScene } from './three/ThreeGameScene';

export interface GameCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onStateChange: (state: GameState) => void;
  onLogTelemetry: (entry: TelemetryLogEntry) => void;
  onNodesUpdate: (nodes: SovereignNode[]) => void;
}

export class GameController {
  private threeScene: ThreeGameScene;
  private callbacks: GameCallbacks;

  public state: GameState = 'TITLE';

  // Player Kinematics
  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerTargetRotationZ = 0;
  private fireCooldown = 0;
  private totemActiveTime = 0;
  private totemCooldowns: Record<TotemId, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
  };

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
    wave: 1,
    activeTotem: 'A',
    pulsesFired: 0,
    enemiesDestroyed: 0,
    nodesPreserved: 221,
    uptimeSeconds: 0,
  };

  // Sovereign Nodes
  public nodes: SovereignNode[] = JSON.parse(JSON.stringify(KEY_RADAR_NODES));

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
    // Avoid default scrolling on Space and Arrow keys during gameplay
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
        this.startGame();
      }
    } else if (this.state === 'PLAYING') {
      if (e.code === 'Escape') {
        this.pauseGame();
      }
      // Totem selection via numbers 1-7
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
      // Special Golden Ratio Harmonic Wave: Q or E
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        this.triggerPhiHarmonicWave();
      }
    } else if (this.state === 'PAUSED') {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        this.resumeGame();
      }
    } else if (this.state === 'GAME_OVER' || this.state === 'VICTORY') {
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

  public startGame() {
    this.state = 'PLAYING';
    this.stats.hull = 100;
    this.stats.shield = 100;
    this.stats.score = 0;
    this.stats.multiplier = 1.0;
    this.stats.wave = 1;
    this.stats.resonance460k = 20;
    this.playerPos.set(0, 0, 0);
    this.playerVel.set(0, 0, 0);

    // Reset nodes
    this.nodes = JSON.parse(JSON.stringify(KEY_RADAR_NODES));
    this.callbacks.onNodesUpdate(this.nodes);

    this.startWave(1);
    this.callbacks.onStateChange(this.state);
    this.callbacks.onStatsUpdate(this.stats);

    sound.playTotemActivate();
    this.logTelemetry('SYSTEM BOOT: Sovereign Interceptor engaged. Mukaab Core online.', 'SUCCESS');
    this.logTelemetry('DEFENSE GRID: 221 realms linked across Saudi, UAE, Egypt, Commonwealth.', 'INFO');
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
    // Clear all existing actors
    this.threeScene.enemies.forEach(e => this.threeScene.scene.remove(e.group));
    this.threeScene.enemies = [];
    this.threeScene.lasers.forEach(l => this.threeScene.scene.remove(l.mesh));
    this.threeScene.lasers = [];
    this.threeScene.crystals.forEach(c => this.threeScene.scene.remove(c.mesh));
    this.threeScene.crystals = [];

    this.startGame();
  }

  public switchTotem(id: TotemId) {
    if (this.stats.activeTotem === id) return;
    this.stats.activeTotem = id;
    const totem = TOTEMS[id];
    this.totemActiveTime = totem.duration;

    sound.playTotemActivate();
    this.threeScene.spawnExplosion(this.playerPos, new THREE.Color(totem.color).getHex(), 16);
    this.logTelemetry(`TOTEM ACTIVATION [${totem.code}]: ${totem.name} (${totem.abilityName})`, 'TOTEM');

    // Trigger immediate ability perks
    if (id === 'F') {
      // Hyperspace Kinetic Dash
      sound.playDash();
      this.playerVel.z -= 35;
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
    this.threeScene.addScreenShake(1.6);
    this.threeScene.triggerHitstop(80);

    // Annihilate or heavily damage all active hostiles
    this.threeScene.enemies.forEach(enemy => {
      enemy.health -= 150;
      this.threeScene.spawnExplosion(enemy.position, 0xffd978, 20);
    });

    this.logTelemetry('HARMONIC DISCHARGE: Golden Ratio (Φ = 1.618) wave cleared all vector sectors!', 'SUCCESS');
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private startWave(waveNum: number) {
    this.stats.wave = waveNum;
    this.enemiesRemainingToSpawn = 8 + waveNum * 5;
    this.spawnTimer = 1.0;
    this.bossSpawned = false;

    this.logTelemetry(`TACTICAL ALERT: Wave ${waveNum} incursion detected. Threat Level: ${waveNum * 15}%`, 'ALERT');
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private startLoop() {
    this.isRunning = true;
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.isRunning) return;

      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;

      // Clamped frame delta per game craft instructions
      const dt = Math.min(rawDt, 0.05);

      if (this.state === 'PLAYING') {
        this.updateSimulation(dt);
      }

      this.threeScene.update(dt, this.state === 'PLAYING', this.stats.activeTotem, this.playerPos);

      // Reset edge-triggered inputs
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
      this.stats.shield = Math.min(this.stats.maxShield, this.stats.shield + dt * 4.0);
    }

    // 2. Player Input Kinematics
    let moveX = 0;
    let moveZ = 0;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveZ -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveZ += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveX += 1;

    // Normalize diagonal speed
    if (moveX !== 0 && moveZ !== 0) {
      moveX *= 0.7071;
      moveZ *= 0.7071;
    }

    const accel = 85.0;
    const maxSpeed = this.stats.activeTotem === 'F' ? 42.0 : 26.0;

    this.playerVel.x += moveX * accel * dt;
    this.playerVel.z += moveZ * accel * dt;

    // Damping friction
    this.playerVel.multiplyScalar(Math.exp(-dt * 6.5));
    this.playerPos.addScaledVector(this.playerVel, dt);

    // Constrain within tactical operational arena
    const arenaRadius = 42;
    if (this.playerPos.length() > arenaRadius) {
      this.playerPos.clampLength(0, arenaRadius);
    }

    // Banking roll tilt (squash and stretch response)
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
      this.spawnTimer = Math.max(0.7, 2.5 - this.stats.wave * 0.2);
    }

    // Boss spawn check for wave 5, 10
    if (this.stats.wave % 5 === 0 && !this.bossSpawned && this.enemiesRemainingToSpawn <= 3) {
      this.spawnBoss();
      this.bossSpawned = true;
    }

    // Check wave complete
    if (this.enemiesRemainingToSpawn <= 0 && this.threeScene.enemies.length === 0) {
      this.waveClearTimer += dt;
      if (this.waveClearTimer > 2.0) {
        this.waveClearTimer = 0;
        this.stats.score += 2000 * this.stats.wave;
        this.stats.resonance460k = Math.min(100, this.stats.resonance460k + 30);
        sound.playTotemActivate();
        this.logTelemetry(`WAVE ${this.stats.wave} SECURED! All tactical vectors neutralized.`, 'SUCCESS');
        this.startWave(this.stats.wave + 1);
      }
    }

    // 5. Update Enemies & AI
    this.updateEnemies(dt);

    // 6. Laser Collision Detection
    this.checkLaserCollisions();

    // 7. Crystal Collection
    this.checkCrystalCollections();

    // 8. Regular Telemetry dispatch to UI
    if (this.telemetryTimer > 0.2) {
      this.telemetryTimer = 0;
      this.callbacks.onStatsUpdate({ ...this.stats });
      this.callbacks.onNodesUpdate([...this.nodes]);
    }
  }

  private executePlayerFire() {
    const isTotemA = this.stats.activeTotem === 'A';
    const isTotemD = this.stats.activeTotem === 'D';
    this.fireCooldown = isTotemA ? 0.12 : 0.18;
    this.stats.pulsesFired += 1;

    sound.playLaser(isTotemA);
    this.threeScene.addScreenShake(isTotemA ? 0.22 : 0.1);

    const forward = new THREE.Vector3(0, 0, -1);
    const originL = this.playerPos.clone().add(new THREE.Vector3(-1.1, 1.0, -1.0));
    const originR = this.playerPos.clone().add(new THREE.Vector3(1.1, 1.0, -1.0));

    const color = isTotemA ? '#ffd978' : isTotemD ? '#ff9e00' : '#00f0ff';
    const damage = isTotemA ? 40 : 25;

    this.threeScene.fireLaser(originL, forward, false, color, damage);
    this.threeScene.fireLaser(originR, forward, false, color, damage);

    // If Totem D (Triple Expansion), fire angled wing lasers
    if (isTotemD) {
      const leftDir = new THREE.Vector3(-0.35, 0, -0.93).normalize();
      const rightDir = new THREE.Vector3(0.35, 0, -0.93).normalize();
      this.threeScene.fireLaser(originL, leftDir, false, '#ff9e00', 25);
      this.threeScene.fireLaser(originR, rightDir, false, '#ff9e00', 25);
    }
  }

  private spawnNextEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 48 + Math.random() * 8;
    const pos = new THREE.Vector3(Math.cos(angle) * spawnDist, 1.2, Math.sin(angle) * spawnDist);

    let type: EnemyType = 'SWARMER';
    const r = Math.random();
    if (this.stats.wave >= 2 && r > 0.6) {
      type = 'CORRUPTOR';
    } else if (this.stats.wave >= 3 && r > 0.35) {
      type = 'DISRUPTOR';
    }

    // Pick random target node to threaten
    const targetNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];

    this.threeScene.spawnEnemy(type, pos, targetNode?.id || null);
    this.enemiesRemainingToSpawn--;
  }

  private spawnBoss() {
    const pos = new THREE.Vector3(0, 1.5, -50);
    this.threeScene.spawnEnemy('DREADNOUGHT', pos, null);
    sound.playNodeAlert();
    this.logTelemetry('WARNING: Imperial Dreadnought sovereign carrier warp-in confirmed!', 'ALERT');
  }

  private updateEnemies(dt: number) {
    const playerPosition = this.playerPos;

    for (let i = this.threeScene.enemies.length - 1; i >= 0; i--) {
      const enemy = this.threeScene.enemies[i];
      enemy.fireTimer -= dt;

      // AI Movement Logic
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

      // Enemy firing attacks with telegraph
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = enemy.type === 'CORRUPTOR' ? 2.5 : 1.8;
        const shootDir = new THREE.Vector3().subVectors(playerPosition, enemy.position).normalize();
        this.threeScene.fireLaser(enemy.position, shootDir, true, '#ff3366', 15);
      }

      // Check collision with player
      const distToPlayer = enemy.position.distanceTo(playerPosition);
      if (distToPlayer < enemy.radius + 1.4) {
        this.takeDamage(enemy.type === 'CORRUPTOR' ? 30 : 15);
        enemy.health -= 35;
        this.threeScene.spawnExplosion(enemy.position, 0xff3366, 14);
      }

      // Check collision with target sovereign node
      if (enemy.targetNodeId) {
        const node = this.nodes.find(n => n.id === enemy.targetNodeId);
        if (node && enemy.position.distanceTo(new THREE.Vector3(node.x, 0, node.z)) < 3.0) {
          node.health = Math.max(0, node.health - dt * 25);
          if (node.health <= 0) {
            node.status = 'CRITICAL';
            this.logTelemetry(`BREACH: ${node.name} communications severed!`, 'ALERT');
          } else {
            node.status = 'DEFENDING';
          }
        }
      }

      // Death check
      if (enemy.health <= 0) {
        this.destroyEnemy(i, enemy);
      }
    }
  }

  private destroyEnemy(index: number, enemy: EnemyActor) {
    this.threeScene.spawnExplosion(enemy.position, enemy.type === 'DREADNOUGHT' ? 0xff0055 : 0xffa500, 32);
    this.threeScene.triggerHitstop(enemy.type === 'DREADNOUGHT' ? 80 : 40);
    this.threeScene.addScreenShake(enemy.type === 'DREADNOUGHT' ? 1.5 : 0.4);
    sound.playHeavyImpact();

    // Spawn 460k crystal shards
    const shardCount = enemy.type === 'DREADNOUGHT' ? 8 : enemy.type === 'CORRUPTOR' ? 3 : 1;
    for (let k = 0; k < shardCount; k++) {
      this.threeScene.spawnCrystalShard(enemy.position, 15);
    }

    this.stats.enemiesDestroyed += 1;
    this.stats.score += Math.round(enemy.scoreValue * this.stats.multiplier);
    this.stats.multiplier = Math.min(5.0, Number((this.stats.multiplier + 0.1).toFixed(1)));

    this.threeScene.scene.remove(enemy.group);
    this.threeScene.enemies.splice(index, 1);
  }

  private checkLaserCollisions() {
    for (let l = this.threeScene.lasers.length - 1; l >= 0; l--) {
      const laser = this.threeScene.lasers[l];

      if (!laser.isEnemy) {
        // Player laser hits enemies
        for (let e = this.threeScene.enemies.length - 1; e >= 0; e--) {
          const enemy = this.threeScene.enemies[e];
          if (laser.position.distanceTo(enemy.position) < enemy.radius + 0.8) {
            enemy.health -= laser.damage;
            sound.playHeavyImpact();
            this.threeScene.spawnExplosion(laser.position, 0xffd978, 8);

            // Remove laser
            this.threeScene.scene.remove(laser.mesh);
            this.threeScene.lasers.splice(l, 1);

            if (enemy.health <= 0) {
              this.destroyEnemy(e, enemy);
            }
            break;
          }
        }
      } else {
        // Enemy laser hits player
        if (laser.position.distanceTo(this.playerPos) < 2.0) {
          // If active Totem C (Soberanía Planetaria Aegis), reflect projectile back!
          if (this.stats.activeTotem === 'C') {
            sound.playShieldDeflect();
            laser.isEnemy = false;
            laser.velocity.multiplyScalar(-1.4);
            laser.color = '#00f0ff';
            (laser.mesh.material as THREE.MeshBasicMaterial).color.set(0x00f0ff);
            this.logTelemetry('AEGIS REFLECTION: Enemy laser bounced back by Totem C ward!', 'INFO');
          } else {
            this.takeDamage(laser.damage);
            this.threeScene.spawnExplosion(laser.position, 0xff3366, 10);
            this.threeScene.scene.remove(laser.mesh);
            this.threeScene.lasers.splice(l, 1);
          }
        }
      }
    }
  }

  private takeDamage(amount: number) {
    this.threeScene.addScreenShake(0.6);

    if (this.stats.shield > 0) {
      sound.playShieldDeflect();
      this.stats.shield -= amount;
      if (this.stats.shield < 0) {
        this.stats.hull += this.stats.shield;
        this.stats.shield = 0;
      }
    } else {
      sound.playHeavyImpact();
      this.stats.hull -= amount;
    }

    this.stats.multiplier = 1.0; // Reset combo multiplier

    if (this.stats.hull <= 0) {
      this.stats.hull = 0;
      this.handleGameOver();
    }

    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private checkCrystalCollections() {
    for (let i = this.threeScene.crystals.length - 1; i >= 0; i--) {
      const crystal = this.threeScene.crystals[i];
      if (crystal.position.distanceTo(this.playerPos) < 2.2) {
        sound.playCrystalCollect();
        this.stats.resonance460k = Math.min(100, this.stats.resonance460k + crystal.value);
        this.stats.score += 150;

        this.threeScene.scene.remove(crystal.mesh);
        (crystal.mesh.material as THREE.Material).dispose();
        this.threeScene.crystals.splice(i, 1);

        if (this.stats.resonance460k >= 100) {
          this.logTelemetry('Φ HARMONIC CHARGE 100%: Golden Ratio Wave ready! [Press Q/E]', 'SUCCESS');
        }
      }
    }
  }

  private handleGameOver() {
    this.state = 'GAME_OVER';
    sound.playHeavyImpact();
    this.threeScene.spawnExplosion(this.playerPos, 0xff3366, 45);
    this.callbacks.onStateChange(this.state);
    this.logTelemetry('CRITICAL FAILURE: Mukaab Interceptor destroyed. Sovereign grid collapsed.', 'ALERT');
  }

  private logTelemetry(message: string, type: TelemetryLogEntry['type']) {
    const now = new Date().toISOString().split('T')[1].slice(0, 8);
    const entry: TelemetryLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: `${now}Z`,
      message,
      type,
    };
    this.callbacks.onLogTelemetry(entry);
  }

  public dispose() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
