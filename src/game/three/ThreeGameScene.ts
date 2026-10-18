import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { KEY_RADAR_NODES, TOTEMS } from '../../data/sovereignData';
import {
  BossLiveState,
  BossSpec,
  CameraMode,
  ChapterId,
  KillRecord,
  ReplayCameraPerspective,
  SovereignNode,
  TotemId,
} from '../../types/game';

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
  type: 'SWARMER' | 'CORRUPTOR' | 'DISRUPTOR' | 'DREADNOUGHT' | 'BOSS';
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  radius: number;
  scoreValue: number;
  windupTime: number;
  fireTimer: number;
  hitFlashTime: number;
  targetNodeId: string | null;
  // Boss specific properties
  isBoss?: boolean;
  bossPhase?: number;
  bossShieldActive?: boolean;
  bossShieldMesh?: THREE.Mesh;
  bossCoreMesh?: THREE.Mesh;
  bossRotators?: THREE.Group[];
  bossSpec?: BossSpec;
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
  gravity?: number;
  drag?: number;
}

// Module-scope temporary math vectors to prevent garbage collection in render loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _vCamTarget = new THREE.Vector3();

export class ThreeGameScene {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private pmremGenerator: THREE.PMREMGenerator | null = null;

  // Lighting
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

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

  // Boss & Telegraph Reticle
  public activeBoss: EnemyActor | null = null;
  public telegraphGroup: THREE.Group;
  private telegraphOuterRing: THREE.Mesh;
  private telegraphInnerDisc: THREE.Mesh;

  // Camera Management
  public cameraMode: CameraMode = 'CHASE';
  private cameraIntroTimer = 0;
  private cameraKillTimer = 0;
  private killCamTarget = new THREE.Vector3(0, 0, 0);

  // Cinematic Replay System
  public replayKills: KillRecord[] = [];
  public replayTime = 0;
  public replaySpeed = 1.0;
  public replayPerspective: ReplayCameraPerspective = 'ENEMY_POV';
  private replayMarkersGroup: THREE.Group;
  private replaySegmentDuration = 2.4; // seconds per kill waypoint
  private replayDetonationTriggered = new Set<number>();

  // Visual Feedback
  public cameraShake = 0;
  public hitstopTimer = 0;
  private laserGeo: THREE.CylinderGeometry;
  private crystalGeo: THREE.OctahedronGeometry;
  private thrusterTimer = 0;

  // Title screen camera orbit
  private titleAngle = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Horizon Fog
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
    this.keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    this.keyLight.position.set(20, 45, 25);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 120;
    this.keyLight.shadow.camera.left = -35;
    this.keyLight.shadow.camera.right = 35;
    this.keyLight.shadow.camera.top = 35;
    this.keyLight.shadow.camera.bottom = -35;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x00f0ff, 0x111625, 1.2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xdfb15b, 1.8);
    this.rimLight.position.set(-25, 20, -30);
    this.scene.add(this.rimLight);

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

    // Ground Contact shadow plane beneath player
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

    // 7. Telegraph Warning Reticle Group (Ground projected)
    this.telegraphGroup = new THREE.Group();
    this.telegraphGroup.visible = false;
    this.telegraphGroup.position.y = 0.06;

    const outerRingGeo = new THREE.RingGeometry(2.8, 3.2, 36);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.telegraphOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.telegraphOuterRing.rotation.x = -Math.PI / 2;
    this.telegraphGroup.add(this.telegraphOuterRing);

    const innerDiscGeo = new THREE.CircleGeometry(2.8, 36);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.telegraphInnerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    this.telegraphInnerDisc.rotation.x = -Math.PI / 2;
    this.telegraphGroup.add(this.telegraphInnerDisc);

    this.scene.add(this.telegraphGroup);

    // 8. Replay Hologram Markers Group
    this.replayMarkersGroup = new THREE.Group();
    this.replayMarkersGroup.visible = false;
    this.scene.add(this.replayMarkersGroup);

    // 9. Assemble 8-part Composite Procedural Player Interceptor
    const { ship, coreCube, gyroRings, shield, wingL, wingR } = this.createPlayerShip();
    this.playerShip = ship;
    this.playerCoreCube = coreCube;
    this.playerGyroRings = gyroRings;
    this.playerShieldMesh = shield;
    this.playerWingLeft = wingL;
    this.playerWingRight = wingR;
    this.scene.add(this.playerShip);

    // 10. Reusable Shared Geometries
    this.laserGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8);
    this.laserGeo.rotateX(Math.PI / 2);
    this.crystalGeo = new THREE.OctahedronGeometry(0.4, 0);

    // 11. Build Sovereign Beacons for Key Global Nodes
    this.buildSovereignGridNodes(KEY_RADAR_NODES);

    // Warm up shaders
    this.renderer.compile(this.scene, this.camera);
  }

  /**
   * Applies atmospheric lighting and fog theme according to selected chapter
   */
  public applyChapterAtmosphere(ambientHex: number, fogDensity: number) {
    this.scene.background = new THREE.Color(ambientHex);
    this.scene.fog = new THREE.FogExp2(ambientHex, fogDensity);
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

    // 6. Dual Aft Ion Thrusters
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const thrusterL = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterL.position.set(-0.6, 1.0, 1.1);
    const thrusterR = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterR.position.set(0.6, 1.0, 1.1);
    ship.add(thrusterL);
    ship.add(thrusterR);

    // 7. Spherical Aegis Shield Bubble
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
   * Spawns standard hostile actors
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

      const coreGeo = new THREE.SphereGeometry(0.6, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      const frameGeo = new THREE.TorusGeometry(1.6, 0.06, 8, 24);
      const frameMat = new THREE.MeshBasicMaterial({ color: 0xff3366, wireframe: true });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      group.add(frame);
    } else if (type === 'DISRUPTOR') {
      maxHealth = 60;
      radius = 1.4;
      scoreValue = 450;

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
      // DREADNOUGHT INTERCEPTOR
      maxHealth = 350;
      radius = 3.2;
      scoreValue = 2800;

      const bossHull = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 1.8, 6.0),
        new THREE.MeshPhysicalMaterial({ color: 0x1f192b, metalness: 0.9, roughness: 0.25, emissive: 0x48113a })
      );
      bossHull.castShadow = true;
      group.add(bossHull);

      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.0, 2.0),
        new THREE.MeshStandardMaterial({ color: 0xff3366, roughness: 0.2, metalness: 0.8 })
      );
      bridge.position.set(0, 1.3, 0.6);
      group.add(bridge);
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
   * Spawns a high-fidelity 6-to-12 part procedural Boss Titan for the current chapter
   */
  public spawnBossTitan(chapterId: ChapterId, spec: BossSpec, pos: THREE.Vector3): EnemyActor {
    const group = new THREE.Group();
    group.position.copy(pos);

    const rotators: THREE.Group[] = [];
    let coreMesh: THREE.Mesh | undefined;
    let shieldMesh: THREE.Mesh | undefined;

    const bossColor = new THREE.Color(spec.color);
    const accentColor = new THREE.Color(spec.accentColor);

    if (chapterId === 1) {
      // CHAPTER 1: MALPHAS DREADNOUGHT SOVEREIGN
      const mainHullGeo = new THREE.BoxGeometry(6.5, 2.4, 10.0);
      const hullMat = new THREE.MeshPhysicalMaterial({
        color: 0x191e28,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x220511,
      });
      const mainHull = new THREE.Mesh(mainHullGeo, hullMat);
      mainHull.castShadow = true;
      group.add(mainHull);

      const spire = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 1.8, 4.0),
        new THREE.MeshStandardMaterial({ color: 0x2a1525, metalness: 0.8, roughness: 0.3 })
      );
      spire.position.set(0, 2.0, 0.5);
      group.add(spire);

      const plasmaCoreGeo = new THREE.SphereGeometry(1.6, 16, 16);
      const plasmaMat = new THREE.MeshBasicMaterial({ color: bossColor });
      coreMesh = new THREE.Mesh(plasmaCoreGeo, plasmaMat);
      coreMesh.position.set(0, 0.6, -2.5);
      group.add(coreMesh);

      const leftSpikeGroup = new THREE.Group();
      leftSpikeGroup.position.set(-4.5, 0.5, 0);
      const spikeGeo = new THREE.ConeGeometry(0.8, 3.2, 4);
      spikeGeo.rotateZ(Math.PI / 2);
      const spikeMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.9, roughness: 0.2 });
      const leftSpike = new THREE.Mesh(spikeGeo, spikeMat);
      leftSpikeGroup.add(leftSpike);
      group.add(leftSpikeGroup);
      rotators.push(leftSpikeGroup);

      const rightSpikeGroup = new THREE.Group();
      rightSpikeGroup.position.set(4.5, 0.5, 0);
      const rightSpike = new THREE.Mesh(spikeGeo, spikeMat);
      rightSpike.rotation.z = Math.PI;
      rightSpikeGroup.add(rightSpike);
      group.add(rightSpikeGroup);
      rotators.push(rightSpikeGroup);

      const lanceGeo = new THREE.CylinderGeometry(0.25, 0.35, 4.2, 10);
      lanceGeo.rotateX(Math.PI / 2);
      const lanceMat = new THREE.MeshStandardMaterial({ color: 0x444d5c, metalness: 0.9, roughness: 0.15 });
      const lanceL = new THREE.Mesh(lanceGeo, lanceMat);
      lanceL.position.set(-2.2, 0.2, -4.5);
      const lanceR = new THREE.Mesh(lanceGeo, lanceMat);
      lanceR.position.set(2.2, 0.2, -4.5);
      group.add(lanceL);
      group.add(lanceR);
    } else if (chapterId === 2) {
      // CHAPTER 2: OUROBOROS VOID SINGULARITY LEVIATHAN
      const centerSphereGeo = new THREE.SphereGeometry(2.4, 24, 24);
      const centerMat = new THREE.MeshPhysicalMaterial({
        color: 0x130722,
        emissive: 0x481177,
        roughness: 0.1,
        metalness: 0.95,
        clearcoat: 1.0,
      });
      coreMesh = new THREE.Mesh(centerSphereGeo, centerMat);
      group.add(coreMesh);

      const ring1Group = new THREE.Group();
      const ring1Geo = new THREE.TorusGeometry(3.6, 0.35, 12, 48);
      const ring1Mat = new THREE.MeshStandardMaterial({ color: bossColor, metalness: 0.9, roughness: 0.2 });
      const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
      ring1Group.add(ring1);
      group.add(ring1Group);
      rotators.push(ring1Group);

      const ring2Group = new THREE.Group();
      const ring2Geo = new THREE.TorusGeometry(5.0, 0.25, 12, 48);
      const ring2Mat = new THREE.MeshBasicMaterial({ color: accentColor, wireframe: true });
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2Group.add(ring2);
      group.add(ring2Group);
      rotators.push(ring2Group);

      for (let i = 0; i < 4; i++) {
        const satNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: accentColor }));
        const angle = (i * Math.PI) / 2;
        satNode.position.set(Math.cos(angle) * 5.2, 0, Math.sin(angle) * 5.2);
        ring2Group.add(satNode);
      }
    } else if (chapterId === 3) {
      // CHAPTER 3: COLOSSUS AEGIS FORTRESS DREADNOUGHT
      const fortressGeo = new THREE.ConeGeometry(5.8, 9.0, 3);
      fortressGeo.rotateX(Math.PI / 2);
      const fortressMat = new THREE.MeshPhysicalMaterial({
        color: 0x142030,
        emissive: 0x051d30,
        metalness: 0.88,
        roughness: 0.22,
      });
      const fortressMesh = new THREE.Mesh(fortressGeo, fortressMat);
      fortressMesh.castShadow = true;
      group.add(fortressMesh);

      const pylonGeo = new THREE.CylinderGeometry(1.2, 1.8, 3.5, 6);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x243b55, metalness: 0.9, roughness: 0.2 });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(0, 1.8, 0);
      group.add(pylon);

      coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: bossColor }));
      coreMesh.position.set(0, 3.2, 0);
      group.add(coreMesh);

      const orbitGroup = new THREE.Group();
      orbitGroup.position.set(0, 2.0, 0);
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 4), new THREE.MeshStandardMaterial({ color: accentColor }));
        const ang = (i * Math.PI * 2) / 3;
        shard.position.set(Math.cos(ang) * 4.2, 0, Math.sin(ang) * 4.2);
        shard.rotation.z = Math.PI / 2;
        orbitGroup.add(shard);
      }
      group.add(orbitGroup);
      rotators.push(orbitGroup);
    } else {
      // CHAPTER 4: THE GOLDEN TESSERACT APEX OVERLORD
      const outerCubeGeo = new THREE.BoxGeometry(5.2, 5.2, 5.2);
      const outerCubeMat = new THREE.MeshStandardMaterial({
        color: 0xffd978,
        wireframe: true,
        roughness: 0.1,
        metalness: 0.95,
      });
      const outerCube = new THREE.Mesh(outerCubeGeo, outerCubeMat);
      group.add(outerCube);

      const innerCubeGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
      const innerCubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffe600,
        emissive: 0x775c00,
        roughness: 0.15,
        metalness: 0.9,
        clearcoat: 1.0,
      });
      coreMesh = new THREE.Mesh(innerCubeGeo, innerCubeMat);
      group.add(coreMesh);

      for (let r = 1; r <= 3; r++) {
        const ringGrp = new THREE.Group();
        const rGeo = new THREE.TorusGeometry(3.2 + r * 1.1, 0.15, 8, 48);
        const rMat = new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? 0xffd978 : 0xff9e00 });
        const ringM = new THREE.Mesh(rGeo, rMat);
        ringGrp.add(ringM);
        ringGrp.rotation.x = (r * Math.PI) / 4;
        ringGrp.rotation.y = (r * Math.PI) / 6;
        group.add(ringGrp);
        rotators.push(ringGrp);
      }
    }

    const shieldGeo = new THREE.SphereGeometry(6.2, 32, 32);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.4,
      transmission: 0.7,
      roughness: 0.1,
      depthWrite: false,
      wireframe: true,
    });
    shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.visible = false;
    group.add(shieldMesh);

    this.scene.add(group);

    const bossActor: EnemyActor = {
      id: spec.id,
      type: 'BOSS',
      group,
      position: group.position,
      velocity: new THREE.Vector3(0, 0, 0),
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      radius: 5.5,
      scoreValue: 15000,
      windupTime: 0,
      fireTimer: 2.0,
      hitFlashTime: 0,
      targetNodeId: null,
      isBoss: true,
      bossPhase: 1,
      bossShieldActive: false,
      bossShieldMesh: shieldMesh,
      bossCoreMesh: coreMesh,
      bossRotators: rotators,
      bossSpec: spec,
    };

    this.activeBoss = bossActor;
    this.enemies.push(bossActor);

    this.triggerBossIntroCamera(bossActor.position);

    return bossActor;
  }

  /**
   * Triggers cinematic intro camera cut framing the boss
   */
  public triggerBossIntroCamera(bossPos: THREE.Vector3) {
    this.cameraMode = 'BOSS_INTRO';
    this.cameraIntroTimer = 2.8;
    this.addScreenShake(1.2);
  }

  /**
   * Triggers dramatic slow-motion kill cam on boss destruction
   */
  public triggerBossKillCam(bossPos: THREE.Vector3) {
    this.cameraMode = 'KILL_CAM';
    this.cameraKillTimer = 3.2;
    this.killCamTarget.copy(bossPos);
    this.triggerHitstop(120);
    this.addScreenShake(2.5);

    this.spawnVolumetricShockwave(bossPos, 0xffd978, 90, 8.0);
    this.spawnVolumetricShockwave(bossPos, 0xff3366, 70, 12.0);
    this.spawnVolumetricShockwave(bossPos, 0x00f0ff, 50, 16.0);
  }

  /**
   * Starts high-speed cinematic replay flythrough of the battlefield
   */
  public startReplayFlythrough(killHistory: KillRecord[]) {
    this.replayKills = [...killHistory];
    this.replayTime = 0;
    this.replayDetonationTriggered.clear();
    this.cameraMode = 'REPLAY_FLYTHROUGH';

    // Clear and build holographic kill markers on battlefield
    while (this.replayMarkersGroup.children.length > 0) {
      const child = this.replayMarkersGroup.children[0];
      this.replayMarkersGroup.remove(child);
    }

    this.replayKills.forEach((k, idx) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.set(k.position.x, 0.1, k.position.z);

      const ringGeo = new THREE.RingGeometry(1.2, 1.45, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: k.isBoss ? 0xffd978 : 0xff3366,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      markerGroup.add(ring);

      const beaconGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: k.isBoss ? 0xffd978 : 0xff3366,
        transparent: true,
        opacity: 0.45,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 1.75;
      markerGroup.add(beacon);

      this.replayMarkersGroup.add(markerGroup);
    });

    this.replayMarkersGroup.visible = true;
  }

  /**
   * Stops replay and restores standard camera
   */
  public stopReplay() {
    this.cameraMode = 'CHASE';
    this.replayMarkersGroup.visible = false;
  }

  /**
   * Toggles camera view mode
   */
  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  /**
   * Updates telegraph warning reticle on the battlefield floor
   */
  public updateTelegraphReticle(telegraph: BossLiveState['telegraphAttack']) {
    if (!telegraph || !telegraph.active) {
      this.telegraphGroup.visible = false;
      return;
    }

    this.telegraphGroup.visible = true;
    this.telegraphGroup.position.set(telegraph.targetX, 0.08, telegraph.targetZ);

    const radius = telegraph.radius || 3.0;
    this.telegraphOuterRing.scale.set(radius / 3.0, radius / 3.0, 1);

    const innerScale = Math.max(0.01, (telegraph.progress * radius) / 3.0);
    this.telegraphInnerDisc.scale.set(innerScale, innerScale, 1);
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
      gravity: 9.8,
    });
  }

  /**
   * High-Density Volumetric Particle Shockwave (Spherical expanding shell)
   */
  public spawnVolumetricShockwave(pos: THREE.Vector3, colorHex: number, count: number = 70, maxRadius: number = 10.0) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 1.2;
      positions[i * 3 + 2] = pos.z;

      const u = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * u - 1);
      const spd = (maxRadius * 1.5) / 1.0;

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * spd;
      velocities[i * 3 + 1] = Math.cos(phi) * spd * 0.45;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * spd;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
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
      maxAge: 1.1,
      gravity: 0,
      drag: 2.2,
    });
  }

  /**
   * Spawns a subtle ion engine thruster plume behind the player ship
   */
  public emitPlayerThrusterParticles(playerPos: THREE.Vector3, isBoosting: boolean) {
    this.thrusterTimer += 0.016;
    if (this.thrusterTimer < 0.05) return;
    this.thrusterTimer = 0;

    const count = isBoosting ? 6 : 2;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const baseColor = new THREE.Color(isBoosting ? 0x00ffff : 0x00f0ff);

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -0.6 : 0.6;
      positions[i * 3] = playerPos.x + side + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = 1.0 + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = playerPos.z + 1.2;

      velocities[i * 3] = (Math.random() - 0.5) * 1.5;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      velocities[i * 3 + 2] = 8.0 + Math.random() * 12.0;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: isBoosting ? 0.45 : 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Points(geo, pMat);
    this.scene.add(mesh);

    this.particles.push({
      positions,
      velocities,
      colors,
      mesh,
      age: 0,
      maxAge: 0.25,
      gravity: 0,
    });
  }

  /**
   * Trigger screen shake
   */
  public addScreenShake(amount: number) {
    this.cameraShake = Math.min(this.cameraShake + amount, 3.0);
  }

  /**
   * Trigger heavy impact hitstop
   */
  public triggerHitstop(durationMs: number = 50) {
    this.hitstopTimer = durationMs / 1000;
  }

  /**
   * Cleanly updates camera choreography, boss kinetics, particle systems, crystal physics, and lasers
   */
  public update(
    dt: number,
    gameState: 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER' | 'CHAPTER_CLEAR' | 'REPLAY',
    activeTotem: TotemId,
    playerPos: THREE.Vector3
  ) {
    // 1. Process Hitstop
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // 2. Camera Shake Exponential Decay
    if (this.cameraShake > 0.001) {
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 10, dt);
    } else {
      this.cameraShake = 0;
    }

    // 3. Cinematic Camera Choreography
    if (gameState === 'TITLE') {
      // Atmospheric Title Screen Live-World Orbit
      this.titleAngle += dt * 0.22;
      const radius = 38;
      this.camera.position.x = Math.sin(this.titleAngle) * radius;
      this.camera.position.z = Math.cos(this.titleAngle) * radius;
      this.camera.position.y = 22 + Math.sin(this.titleAngle * 0.8) * 4;
      this.camera.lookAt(0, 3, 0);

      this.playerShip.rotation.y += dt * 0.8;
      this.playerShip.position.set(0, 2 + Math.sin(this.titleAngle * 2) * 0.5, 0);
    } else if (gameState === 'REPLAY' || this.cameraMode === 'REPLAY_FLYTHROUGH') {
      // HIGH-SPEED BATTLEFIELD REPLAY FLYTHROUGH (Perspective of destroyed enemies)
      this.updateReplayFlythrough(dt);
    } else {
      // STANDARD COMBAT CAMERA MODES
      if (this.cameraMode === 'BOSS_INTRO' && this.cameraIntroTimer > 0) {
        this.cameraIntroTimer -= dt;
        if (this.activeBoss) {
          const bossP = this.activeBoss.position;
          const targetCamX = bossP.x;
          const targetCamY = 12.0;
          const targetCamZ = bossP.z + 24.0;

          this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 5, dt);
          this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 5, dt);
          this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 5, dt);
          this.camera.lookAt(bossP.x, bossP.y + 2.0, bossP.z);
        } else {
          this.cameraMode = 'CHASE';
        }

        if (this.cameraIntroTimer <= 0) {
          this.cameraMode = 'CHASE';
        }
      } else if (this.cameraMode === 'KILL_CAM' && this.cameraKillTimer > 0) {
        this.cameraKillTimer -= dt;
        this.titleAngle += dt * 0.8;
        const dist = 18;
        this.camera.position.x = this.killCamTarget.x + Math.sin(this.titleAngle) * dist;
        this.camera.position.z = this.killCamTarget.z + Math.cos(this.titleAngle) * dist;
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 14, 4, dt);
        this.camera.lookAt(this.killCamTarget);

        if (this.cameraKillTimer <= 0) {
          this.cameraMode = 'CHASE';
        }
      } else if (this.cameraMode === 'TACTICAL_OVERVIEW') {
        const targetCamX = playerPos.x * 0.2;
        const targetCamY = 56;
        const targetCamZ = playerPos.z * 0.2 + 18;

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 6, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 6, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 6, dt);
        this.camera.lookAt(playerPos.x * 0.1, 0, playerPos.z * 0.1 - 2);
      } else {
        const targetCamX = playerPos.x * 0.45;
        const targetCamZ = playerPos.z * 0.45 + 28;
        const targetCamY = 32;

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 6, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 6, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 6, dt);
        this.camera.lookAt(playerPos.x * 0.2, 0, playerPos.z * 0.2 - 3);
      }

      if (this.cameraShake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShake * 1.5;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 1.5;
      }
    }

    // 4. Player Ship Animations & Thrusters
    this.playerGyroRings.rotation.x += dt * 1.8;
    this.playerGyroRings.rotation.y += dt * 2.2;
    this.skyRing.rotation.z += dt * 0.08;

    if (gameState === 'PLAYING') {
      this.emitPlayerThrusterParticles(playerPos, activeTotem === 'F');
    }

    const totemSpec = TOTEMS[activeTotem];
    const shieldMat = this.playerShieldMesh.material as THREE.MeshPhysicalMaterial;
    if (activeTotem === 'C') {
      shieldMat.opacity = THREE.MathUtils.damp(shieldMat.opacity, 0.45, 12, dt);
      this.playerShieldMesh.rotation.y += dt * 2;
    } else {
      shieldMat.opacity = THREE.MathUtils.damp(shieldMat.opacity, 0, 10, dt);
    }

    const coreMat = this.playerCoreCube.material as THREE.MeshPhysicalMaterial;
    if (totemSpec) {
      coreMat.color.lerp(new THREE.Color(totemSpec.color), dt * 4);
    }

    // 5. Boss Titan Kinetics & Rotators
    if (this.activeBoss) {
      if (this.activeBoss.bossRotators) {
        this.activeBoss.bossRotators.forEach((rot, idx) => {
          const speed = (idx + 1) * 1.2 * (idx % 2 === 0 ? 1 : -1);
          rot.rotation.y += dt * speed;
          rot.rotation.x += dt * 0.4;
        });
      }
      if (this.activeBoss.bossCoreMesh) {
        this.activeBoss.bossCoreMesh.rotation.y += dt * 2.5;
      }
      if (this.activeBoss.bossShieldMesh) {
        this.activeBoss.bossShieldMesh.visible = !!this.activeBoss.bossShieldActive;
        if (this.activeBoss.bossShieldMesh.visible) {
          this.activeBoss.bossShieldMesh.rotation.y += dt * 1.5;
        }
      }
    }

    // 6. Update Sovereign Node Beacons
    this.nodeMeshes.forEach(nodeObj => {
      nodeObj.beacon.rotation.y += dt * 1.2;
      nodeObj.ring.rotation.z += dt * 0.5;
    });

    // 7. Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.life += dt;
      laser.position.addScaledVector(laser.velocity, dt);

      if (laser.life >= laser.maxLife || laser.position.length() > 95) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        (laser.mesh.material as THREE.Material).dispose();
        this.lasers.splice(i, 1);
      }
    }

    // 8. Update 460,000E Crystal Shards
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const crystal = this.crystals[i];
      crystal.life += dt;
      crystal.mesh.rotation.y += dt * 3;
      crystal.mesh.rotation.x += dt * 2;

      crystal.velocity.multiplyScalar(Math.exp(-dt * 2.5));
      crystal.position.addScaledVector(crystal.velocity, dt);

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

    // 9. Update Particle Systems
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const count = p.positions.length / 3;
      const posAttr = p.mesh.geometry.attributes.position as THREE.BufferAttribute;

      for (let j = 0; j < count; j++) {
        p.positions[j * 3] += p.velocities[j * 3] * dt;
        p.positions[j * 3 + 1] += p.velocities[j * 3 + 1] * dt;
        p.positions[j * 3 + 2] += p.velocities[j * 3 + 2] * dt;

        if (p.gravity) {
          p.velocities[j * 3 + 1] -= dt * p.gravity;
        }
        if (p.drag) {
          p.velocities[j * 3] *= Math.exp(-dt * p.drag);
          p.velocities[j * 3 + 1] *= Math.exp(-dt * p.drag);
          p.velocities[j * 3 + 2] *= Math.exp(-dt * p.drag);
        }
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

    // 10. Render Frame
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Sweeping high-speed 3D flythrough of the battlefield from the perspective of destroyed enemies
   */
  private updateReplayFlythrough(dt: number) {
    if (this.replayKills.length === 0) {
      // Fallback orbit
      this.titleAngle += dt * 0.3;
      this.camera.position.set(Math.sin(this.titleAngle) * 35, 18, Math.cos(this.titleAngle) * 35);
      this.camera.lookAt(0, 0, 0);
      return;
    }

    // Progress time based on speed
    this.replayTime += dt * this.replaySpeed;

    const totalKills = this.replayKills.length;
    const totalDuration = totalKills * this.replaySegmentDuration;
    const loopedTime = this.replayTime % totalDuration;

    const currentKillIndex = Math.min(totalKills - 1, Math.floor(loopedTime / this.replaySegmentDuration));
    const nextKillIndex = (currentKillIndex + 1) % totalKills;

    const segmentTime = loopedTime - currentKillIndex * this.replaySegmentDuration;
    const segmentProgress = segmentTime / this.replaySegmentDuration; // 0 to 1

    const currentKill = this.replayKills[currentKillIndex];
    const nextKill = this.replayKills[nextKillIndex];

    const pCurrent = _v1.set(currentKill.position.x, currentKill.position.y, currentKill.position.z);
    const pNext = _v2.set(nextKill.position.x, nextKill.position.y, nextKill.position.z);
    const lookDir = _v3.set(currentKill.lookDirection.x, currentKill.lookDirection.y, currentKill.lookDirection.z);

    // Bullet-time slow down right at point of impact (segmentProgress 0.30 - 0.45)
    if (segmentProgress >= 0.32 && segmentProgress <= 0.45 && !this.replayDetonationTriggered.has(currentKillIndex)) {
      this.replayDetonationTriggered.add(currentKillIndex);
      this.addScreenShake(0.85);
      this.spawnVolumetricShockwave(pCurrent, currentKill.isBoss ? 0xffd978 : 0xff3366, 45, 6.0);
    }

    if (this.replayPerspective === 'ENEMY_POV') {
      // Perspective of the incoming and destroyed enemy
      if (segmentProgress < 0.4) {
        // Facing incoming player laser / interceptor vector
        const camX = pCurrent.x - lookDir.x * 2.5;
        const camY = pCurrent.y + 1.2;
        const camZ = pCurrent.z - lookDir.z * 2.5;

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 8, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 8, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 8, dt);

        // Look toward player craft origin
        _vCamTarget.set(pCurrent.x + lookDir.x * 15, 1.2, pCurrent.z + lookDir.z * 15);
        this.camera.lookAt(_vCamTarget);
      } else {
        // High-speed parabolic banking flythrough toward next enemy destruction point
        const t = (segmentProgress - 0.4) / 0.6; // 0 to 1
        const midY = Math.max(pCurrent.y, pNext.y) + 8.0 * Math.sin(t * Math.PI);

        const targetX = THREE.MathUtils.lerp(pCurrent.x, pNext.x, t);
        const targetZ = THREE.MathUtils.lerp(pCurrent.z, pNext.z, t);

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 10, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, midY, 10, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 10, dt);

        this.camera.lookAt(pNext.x, pNext.y + 1.5, pNext.z);
      }
    } else if (this.replayPerspective === 'CHASE_TRAIL') {
      // Swooping chase camera trailing into the enemy destruction
      const t = segmentProgress;
      const targetCamX = THREE.MathUtils.lerp(pCurrent.x - 8, pNext.x - 8, t);
      const targetCamY = THREE.MathUtils.lerp(6, 12, Math.sin(t * Math.PI));
      const targetCamZ = THREE.MathUtils.lerp(pCurrent.z + 10, pNext.z + 10, t);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 6, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 6, dt);

      this.camera.lookAt(pCurrent.x, pCurrent.y + 1.0, pCurrent.z);
    } else {
      // ORBITAL_SWEEP: Majestic low-altitude orbital pass over the battlefield
      const angle = (loopedTime * 0.8) + (currentKillIndex * 0.4);
      const orbitRadius = 22.0;

      const camX = pCurrent.x + Math.sin(angle) * orbitRadius;
      const camY = 16.0 + Math.sin(angle * 1.5) * 4.0;
      const camZ = pCurrent.z + Math.cos(angle) * orbitRadius;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 6, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 6, dt);

      this.camera.lookAt(pCurrent.x, 0, pCurrent.z);
    }
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
