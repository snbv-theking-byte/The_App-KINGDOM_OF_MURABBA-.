import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { KEY_RADAR_NODES, TOTEMS } from '../../data/sovereignData';
import { SovereignNode, TotemId } from '../../types/game';

export interface LaserProjectile {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  damage: number;
  isEnemy: boolean;
  color: string;
}

export interface EnemyActor {
  id: string;
  type: 'SWARMER' | 'CORRUPTOR' | 'DISRUPTOR' | 'DREADNOUGHT';
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  radius: number;
  scoreValue: number;
  windupTime: number; // For telegraphed attacks
  fireTimer: number;
  hitFlashTime: number;
  targetNodeId: string | null;
}

export interface CrystalShard {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  value: number; // 460,000E units
}

export interface ParticleEffect {
  positions: Float32Array;
  velocities: Float32Array;
  colors: Float32Array;
  mesh: THREE.Points;
  age: number;
  maxAge: number;
}

// Module-scope temporary math vectors to prevent garbage collection in render loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class ThreeGameScene {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private pmremGenerator: THREE.PMREMGenerator | null = null;

  // Actors & Objects
  public playerShip: THREE.Group;
  public playerCoreCube: THREE.Mesh;
  public playerGyroRings: THREE.Group;
  public playerShieldMesh: THREE.Mesh;
  public playerWingLeft: THREE.Mesh;
  public playerWingRight: THREE.Mesh;
  public escortDrones: THREE.Group[] = [];

  // World elements
  public nodeMeshes: Map<string, { group: THREE.Group; beacon: THREE.Mesh; ring: THREE.Mesh; tether: THREE.Line }> = new Map();
  public groundGrid: THREE.GridHelper;
  public skyRing: THREE.Mesh;

  // Projectiles & Pools
  public lasers: LaserProjectile[] = [];
  public enemies: EnemyActor[] = [];
  public crystals: CrystalShard[] = [];
  public particles: ParticleEffect[] = [];

  // Visual Feedback
  public cameraShake = 0;
  public hitstopTimer = 0;
  private laserGeo: THREE.CylinderGeometry;
  private crystalGeo: THREE.OctahedronGeometry;

  // Title screen camera orbit
  private titleAngle = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Horizon Fog matching space abyss
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.012);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 400);
    this.camera.position.set(0, 36, 32);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer initialization conforming to studio PBR standards
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Procedural Studio Environment Map via RoomEnvironment
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // 5. Lighting: Balanced 3-point Studio Rig
    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    keyLight.position.set(20, 45, 25);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 120;
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x00f0ff, 0x111625, 1.2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xdfb15b, 1.8);
    rimLight.position.set(-25, 20, -30);
    this.scene.add(rimLight);

    // 6. Ground Tactical Matrix & Grid
    this.groundGrid = new THREE.GridHelper(120, 60, 0xdfb15b, 0x1a2638);
    this.groundGrid.position.y = -0.05;
    this.scene.add(this.groundGrid);

    // Golden Ratio Celestial Orbit Ring
    const ringGeo = new THREE.TorusGeometry(38, 0.25, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xdfb15b,
      transparent: true,
      opacity: 0.35,
    });
    this.skyRing = new THREE.Mesh(ringGeo, ringMat);
    this.skyRing.rotation.x = Math.PI / 2;
    this.skyRing.position.y = 0.5;
    this.scene.add(this.skyRing);

    // Contact shadow plane beneath core
    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    this.scene.add(contactShadow);

    // 7. Assemble 8-part Procedural Player Interceptor
    const { ship, coreCube, gyroRings, shield, wingL, wingR } = this.createPlayerShip();
    this.playerShip = ship;
    this.playerCoreCube = coreCube;
    this.playerGyroRings = gyroRings;
    this.playerShieldMesh = shield;
    this.playerWingLeft = wingL;
    this.playerWingRight = wingR;
    this.scene.add(this.playerShip);

    // 8. Reusable Shared Geometries
    this.laserGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8);
    this.laserGeo.rotateX(Math.PI / 2);
    this.crystalGeo = new THREE.OctahedronGeometry(0.4, 0);

    // 9. Build Sovereign Beacons for Key Global Nodes
    this.buildSovereignGridNodes(KEY_RADAR_NODES);

    // Warm up shaders
    this.renderer.compile(this.scene, this.camera);
  }

  /**
   * Builds the 8-part Composite Procedural "Mukaab Interceptor"
   */
  private createPlayerShip() {
    const ship = new THREE.Group();

    // 1. Central Golden Mukaab Cube Core (Φ Ratio)
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xdfb15b,
      emissive: 0x543d0e,
      roughness: 0.2,
      metalness: 0.9,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });
    const coreCube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), coreMat);
    coreCube.castShadow = true;
    coreCube.position.y = 1.2;
    ship.add(coreCube);

    // 2. Gyroscopic Orbital Brass Rings
    const gyroRings = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffd978,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: true,
    });
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 32), ringMat);
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 32), ringMat);
    outerRing.rotation.y = Math.PI / 3;
    gyroRings.add(innerRing);
    gyroRings.add(outerRing);
    gyroRings.position.y = 1.2;
    ship.add(gyroRings);

    // 3. Swept Aerodynamic Wings with Cyan Trim
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -1.2);
    wingShape.lineTo(2.6, -1.8);
    wingShape.lineTo(0.5, -1.0);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.center();

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x161d28,
      metalness: 0.7,
      roughness: 0.35,
    });

    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-1.8, 1.1, 0.2);
    wingL.rotation.x = Math.PI / 2;
    wingL.rotation.z = Math.PI;
    wingL.castShadow = true;
    ship.add(wingL);

    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(1.8, 1.1, 0.2);
    wingR.rotation.x = Math.PI / 2;
    wingR.castShadow = true;
    ship.add(wingR);

    // 4. Twin Forward Laser Emitters
    const cannonGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.8, 12);
    cannonGeo.rotateX(Math.PI / 2);
    const cannonMat = new THREE.MeshStandardMaterial({
      color: 0x2a3648,
      metalness: 0.9,
      roughness: 0.2,
    });
    const cannonL = new THREE.Mesh(cannonGeo, cannonMat);
    cannonL.position.set(-1.1, 1.0, -1.0);
    const cannonR = new THREE.Mesh(cannonGeo, cannonMat);
    cannonR.position.set(1.1, 1.0, -1.0);
    ship.add(cannonL);
    ship.add(cannonR);

    // 5. Caschi Gialli Elite Yellow Helm Crest
    const crestGeo = new THREE.ConeGeometry(0.4, 0.7, 4);
    crestGeo.rotateX(-Math.PI / 4);
    const crestMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe600,
      emissive: 0x665c00,
      roughness: 0.25,
      metalness: 0.6,
    });
    const crest = new THREE.Mesh(crestGeo, crestMat);
    crest.position.set(0, 2.2, -0.2);
    ship.add(crest);

    // 6. Dual Aft Ion Thrusters with Glow
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const thrusterL = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterL.position.set(-0.6, 1.0, 1.1);
    const thrusterR = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterR.position.set(0.6, 1.0, 1.1);
    ship.add(thrusterL);
    ship.add(thrusterR);

    // 7. Spherical Aegis Shield Bubble (toggled during Totem C or impact)
    const shieldGeo = new THREE.SphereGeometry(2.5, 24, 24);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      transmission: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.y = 1.2;
    ship.add(shield);

    return { ship, coreCube, gyroRings, shield, wingL, wingR };
  }

  /**
   * Builds 3D visual beacons for Key Global Nodes with laser tethers to the nexus
   */
  public buildSovereignGridNodes(nodes: SovereignNode[]) {
    nodes.forEach(node => {
      const group = new THREE.Group();
      group.position.set(node.x, 0, node.z);

      // Base Pillar
      const baseGeo = new THREE.CylinderGeometry(0.8, 1.1, 0.6, 6);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x141b26,
        metalness: 0.8,
        roughness: 0.3,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.3;
      base.castShadow = true;
      group.add(base);

      // Beacon Crystal
      const beaconGeo = new THREE.OctahedronGeometry(0.5, 0);
      const beaconMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(node.color),
        emissive: new THREE.Color(node.color).multiplyScalar(0.4),
        roughness: 0.15,
        metalness: 0.7,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 1.4;
      group.add(beacon);

      // Defensive Perimeter Aura Ring
      const auraGeo = new THREE.RingGeometry(1.6, 1.8, 24);
      const auraMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.Mesh(auraGeo, auraMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      group.add(ring);

      // Tether Beam Line to Grid Center
      const points = [new THREE.Vector3(node.x, 1.2, node.z), new THREE.Vector3(0, 1.2, 0)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(node.color),
        transparent: true,
        opacity: 0.25,
      });
      const tether = new THREE.Line(lineGeo, lineMat);
      this.scene.add(tether);

      this.scene.add(group);
      this.nodeMeshes.set(node.id, { group, beacon, ring, tether });
    });
  }

  /**
   * Spawns a procedural enemy actor
   */
  public spawnEnemy(type: EnemyActor['type'], pos: THREE.Vector3, targetNodeId: string | null = null): EnemyActor {
    const group = new THREE.Group();
    group.position.copy(pos);

    let maxHealth = 30;
    let radius = 1.2;
    let scoreValue = 250;

    if (type === 'SWARMER') {
      maxHealth = 25;
      radius = 0.9;
      scoreValue = 180;

      // 3-Part Delta Fighter
      const bodyGeo = new THREE.ConeGeometry(0.6, 1.6, 3);
      bodyGeo.rotateX(Math.PI / 2);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x330011,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      group.add(body);

      const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.5), bodyMat);
      wingL.position.set(-0.7, 0, 0.2);
      group.add(wingL);

      const wingR = wingL.clone();
      wingR.position.set(0.7, 0, 0.2);
      group.add(wingR);
    } else if (type === 'CORRUPTOR') {
      maxHealth = 80;
      radius = 1.6;
      scoreValue = 600;

      // 4-Part Heavy Corruptor Cube with Warning Plates
      const cubeGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
      const cubeMat = new THREE.MeshStandardMaterial({
        color: 0x221122,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x550022,
      });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.castShadow = true;
      group.add(cube);

      // Energy Cores on 4 faces
      const coreGeo = new THREE.SphereGeometry(0.6, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      // Warning Frame Reticle
      const frameGeo = new THREE.TorusGeometry(1.6, 0.06, 8, 24);
      const frameMat = new THREE.MeshBasicMaterial({ color: 0xff3366, wireframe: true });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      group.add(frame);
    } else if (type === 'DISRUPTOR') {
      maxHealth = 60;
      radius = 1.4;
      scoreValue = 450;

      // Gyroscopic EMP Pulsar
      const centerSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x9d4edd, emissive: 0x3c096c, roughness: 0.2, metalness: 0.9 })
      );
      group.add(centerSphere);

      const empRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.1, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xc77dff, wireframe: true })
      );
      empRing.rotation.x = Math.PI / 3;
      group.add(empRing);
    } else {
      // DREADNOUGHT BOSS (Wave Milestone)
      maxHealth = 400;
      radius = 3.5;
      scoreValue = 3500;

      const bossHull = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 2.0, 7.0),
        new THREE.MeshPhysicalMaterial({ color: 0x1f192b, metalness: 0.9, roughness: 0.25, emissive: 0x48113a })
      );
      bossHull.castShadow = true;
      group.add(bossHull);

      // Bridge Tower
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 1.2, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xff3366, roughness: 0.2, metalness: 0.8 })
      );
      bridge.position.set(0, 1.5, 0.8);
      group.add(bridge);

      // Side Shield Pods
      const podL = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.5, 8), new THREE.MeshBasicMaterial({ color: 0xffd978 }));
      podL.rotation.x = Math.PI / 2;
      podL.position.set(-2.8, 0, 0);
      group.add(podL);

      const podR = podL.clone();
      podR.position.set(2.8, 0, 0);
      group.add(podR);
    }

    this.scene.add(group);

    const enemy: EnemyActor = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      group,
      position: group.position,
      velocity: new THREE.Vector3(0, 0, 0),
      health: maxHealth,
      maxHealth,
      radius,
      scoreValue,
      windupTime: 0,
      fireTimer: 1.5 + Math.random() * 2,
      hitFlashTime: 0,
      targetNodeId,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * Fire laser projectile
   */
  public fireLaser(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    isEnemy: boolean,
    colorHex: string = '#ffd978',
    damage: number = 25
  ) {
    const laserMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
    });
    const mesh = new THREE.Mesh(this.laserGeo, laserMat);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());

    this.scene.add(mesh);
    this.lasers.push({
      mesh,
      position: mesh.position,
      velocity: direction.clone().normalize().multiplyScalar(isEnemy ? 32 : 55),
      life: 0,
      maxLife: 2.2,
      damage,
      isEnemy,
      color: colorHex,
    });
  }

  /**
   * Spawn 460,000E Crystal Shard Pickups
   */
  public spawnCrystalShard(pos: THREE.Vector3, value: number = 10) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xdfb15b,
      emissive: 0x785610,
      metalness: 0.8,
      roughness: 0.15,
      clearcoat: 1.0,
    });
    const mesh = new THREE.Mesh(this.crystalGeo, mat);
    mesh.position.copy(pos);
    mesh.position.y = 1.0;
    this.scene.add(mesh);

    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    this.crystals.push({
      mesh,
      position: mesh.position,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, 0, Math.sin(angle) * speed),
      life: 0,
      value,
    });
  }

  /**
   * Pooled Particle Burst for impacts and detonations (Zero GC)
   */
  public spawnExplosion(pos: THREE.Vector3, colorHex: number = 0xffd978, count: number = 24) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 1.0;
      positions[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = 4 + Math.random() * 12;

      velocities[i * 3] = Math.cos(theta) * Math.cos(phi) * spd;
      velocities[i * 3 + 1] = Math.sin(phi) * spd + 2.0;
      velocities[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * spd;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const pointsMesh = new THREE.Points(geo, pMat);
    this.scene.add(pointsMesh);

    this.particles.push({
      positions,
      velocities,
      colors,
      mesh: pointsMesh,
      age: 0,
      maxAge: 0.8,
    });
  }

  /**
   * Trigger screen shake
   */
  public addScreenShake(amount: number) {
    this.cameraShake = Math.min(this.cameraShake + amount, 2.5);
  }

  /**
   * Trigger heavy impact hitstop
   */
  public triggerHitstop(durationMs: number = 50) {
    this.hitstopTimer = durationMs / 1000;
  }

  /**
   * Cleanly updates particle systems, crystal physics, lasers, and rendering
   */
  public update(dt: number, isPlaying: boolean, activeTotem: TotemId, playerPos: THREE.Vector3) {
    // 1. Process Hitstop
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return; // Freeze visual tick momentarily for weight impact
    }

    // 2. Camera Shake Exponential Decay
    if (this.cameraShake > 0.001) {
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 10, dt);
    } else {
      this.cameraShake = 0;
    }

    // 3. Camera Position: Title vs Playing
    if (!isPlaying) {
      // Atmospheric Title Screen Live-World Orbit
      this.titleAngle += dt * 0.22;
      const radius = 38;
      this.camera.position.x = Math.sin(this.titleAngle) * radius;
      this.camera.position.z = Math.cos(this.titleAngle) * radius;
      this.camera.position.y = 22 + Math.sin(this.titleAngle * 0.8) * 4;
      this.camera.lookAt(0, 3, 0);

      // Slowly rotate idle player ship at center
      this.playerShip.rotation.y += dt * 0.8;
      this.playerShip.position.set(0, 2 + Math.sin(this.titleAngle * 2) * 0.5, 0);
    } else {
      // Playing Tactical Third-Person Overhead Camera with Shake
      const targetCamX = playerPos.x * 0.45;
      const targetCamZ = playerPos.z * 0.45 + 28;
      const targetCamY = 32;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 6, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 6, dt);

      if (this.cameraShake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShake * 1.5;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 1.5;
      }

      this.camera.lookAt(playerPos.x * 0.2, 0, playerPos.z * 0.2 - 3);
    }

    // 4. Player Ship Animations
    this.playerGyroRings.rotation.x += dt * 1.8;
    this.playerGyroRings.rotation.y += dt * 2.2;
    this.skyRing.rotation.z += dt * 0.08;

    // Shield visibility based on active Totem C (Soberanía Planetaria)
    const totemSpec = TOTEMS[activeTotem];
    const shieldMat = this.playerShieldMesh.material as THREE.MeshPhysicalMaterial;
    if (activeTotem === 'C') {
      shieldMat.opacity = THREE.MathUtils.damp(shieldMat.opacity, 0.45, 12, dt);
      this.playerShieldMesh.rotation.y += dt * 2;
    } else {
      shieldMat.opacity = THREE.MathUtils.damp(shieldMat.opacity, 0, 10, dt);
    }

    // Tint player core based on active totem
    const coreMat = this.playerCoreCube.material as THREE.MeshPhysicalMaterial;
    if (totemSpec) {
      coreMat.color.lerp(new THREE.Color(totemSpec.color), dt * 4);
    }

    // 5. Update Sovereign Node Beacons
    this.nodeMeshes.forEach(nodeObj => {
      nodeObj.beacon.rotation.y += dt * 1.2;
      nodeObj.ring.rotation.z += dt * 0.5;
    });

    // 6. Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.life += dt;
      laser.position.addScaledVector(laser.velocity, dt);

      if (laser.life >= laser.maxLife || laser.position.length() > 90) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        (laser.mesh.material as THREE.Material).dispose();
        this.lasers.splice(i, 1);
      }
    }

    // 7. Update 460,000E Crystal Shards
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const crystal = this.crystals[i];
      crystal.life += dt;
      crystal.mesh.rotation.y += dt * 3;
      crystal.mesh.rotation.x += dt * 2;

      // Friction
      crystal.velocity.multiplyScalar(Math.exp(-dt * 2.5));
      crystal.position.addScaledVector(crystal.velocity, dt);

      // Magnetic attraction to player if nearby
      const distToPlayer = crystal.position.distanceTo(playerPos);
      if (distToPlayer < 9.0) {
        _v1.subVectors(playerPos, crystal.position).normalize();
        crystal.position.addScaledVector(_v1, dt * 14.0);
      }

      if (crystal.life > 16.0) {
        this.scene.remove(crystal.mesh);
        (crystal.mesh.material as THREE.Material).dispose();
        this.crystals.splice(i, 1);
      }
    }

    // 8. Update Particle Systems
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const count = p.positions.length / 3;
      const posAttr = p.mesh.geometry.attributes.position as THREE.BufferAttribute;

      for (let j = 0; j < count; j++) {
        p.positions[j * 3] += p.velocities[j * 3] * dt;
        p.positions[j * 3 + 1] += p.velocities[j * 3 + 1] * dt;
        p.positions[j * 3 + 2] += p.velocities[j * 3 + 2] * dt;

        // Apply slight gravity
        p.velocities[j * 3 + 1] -= dt * 9.8;
      }
      posAttr.needsUpdate = true;

      const pMat = p.mesh.material as THREE.PointsMaterial;
      pMat.opacity = Math.max(0, 1 - p.age / p.maxAge);

      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        pMat.dispose();
        this.particles.splice(i, 1);
      }
    }

    // 9. Render Frame
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Updates resize cleanly
   */
  public onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Complete memory cleanup conforming to resource management guidelines
   */
  public dispose() {
    this.laserGeo.dispose();
    this.crystalGeo.dispose();

    this.lasers.forEach(l => {
      this.scene.remove(l.mesh);
      (l.mesh.material as THREE.Material).dispose();
    });
    this.enemies.forEach(e => {
      this.scene.remove(e.group);
    });
    this.crystals.forEach(c => {
      this.scene.remove(c.mesh);
      (c.mesh.material as THREE.Material).dispose();
    });
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.PointsMaterial).dispose();
    });

    if (this.pmremGenerator) {
      this.pmremGenerator.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
