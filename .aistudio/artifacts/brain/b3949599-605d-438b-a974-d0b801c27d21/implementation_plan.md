# Kingdom of Murabba: Sovereign Campaign, Multi-Tier Bosses & Cinematic 3D Combat

Upgrade the Kingdom of Murabba SNBV tactical defense command core with a multi-chapter sovereign campaign, multi-tier boss encounters with telegraphed phase mechanics, dynamic cinematic camera cuts, and high-density volumetric particle systems.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following directions were confirmed during Phase 1 interactive clarification:
> - **Primary Capability**: Advanced 3D tactical combat with multi-tier boss encounters featuring distinct phase mechanics and telegraphed attack vectors.
> - **Visual & Immersion Focus**: Dynamic cinematic camera cuts (boss reveals, phase transitions, tactical vantage angles) and volumetric particle effects.
> - **Game Mode & Pacing**: Multi-chapter story campaign across the 221 sovereign alliance realms with escalating defense waves, chapter progression, and persistent state.

---

### 1. Overview & Core Concept

- **What It Does**: Evolves the single-run prototype into an immersive tactical space combat campaign. Players command the Mukaab Core Defense Craft through 4 distinct story chapters spanning key sovereign territories (Arabian Gulf Sanctuary, Red Sea Orbital Axis, Mediterranean Resonant Corridor, and Mukaab Apex Citadel). Each chapter features unique enemy formations, strategic totem synergies, and climactic multi-phase boss encounters.
- **Target Audience / Persona**: Sci-fi combat enthusiasts and tactical defense strategists seeking responsive dogfighting, strategic superpower combos, and cinematic spectacles.
- **Key Value**: Delivers tangible campaign progression, rewarding skill mastery, visual feedback, and responsive space combat without center-screen viewport occlusion.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Title & Chapter Briefing**: From the main title screen, players can start or resume their sovereign campaign, select unlocked chapters (Chapters 1 to 4), and view territory intelligence (realm nodes, defensive status, threat level).
2. **Tactical Dogfighting & Escalation**: In each chapter, players defend regional sovereign nodes against waves of Swarmers, Corruptors, Disruptors, and Dreadnoughts. Smooth directional steering, double overcharged lasers, and Totem ability invocations clear hostile vectors.
3. **Cinematic Boss Encounter**:
   - *Phase 1 (The Approach)*: Dramatic camera sweep and letterbox reveal of the Chapter Boss with dynamic boss health bar and audio sting.
   - *Phase 2 (Enrage & Mechanics Shift)*: Boss activates tactical shields or summons coronal flak rings at 50% health, triggering a camera focus cut and localized particle storms.
   - *Phase 3 (Climax & Overload)*: Boss charges an orbital annihilation beam requiring player evasive dash or totem counter; upon defeat, explosive volumetric shockwaves erupt with slow-motion hitstop.
4. **Post-Battle Debrief & Chapter Transition**: Score calculation, node survival rating (Gold / Silver / Bronze Sovereign Accolades), and unlocked upgrades / lore logs stored persistently in `localStorage`.

#### Visual Identity & Theme
- **Aesthetic Direction**: Sovereign sci-fi luxury & brutalist cybernetics inspired by the Kingdom of Murabba and Mukaab architectural proportions.
- **Color Palette & Mood**:
  - Deep space void canvas: `#07090e` / `#0b0e17`
  - Sovereign Gold: `#ffd978` / `#ffe600` (Player core, Chapter 1, Totem A/G)
  - Resonant Cyan: `#00f0ff` (Shields, Alliance grid, Chapter 2)
  - Corruptor Crimson / Violet: `#ff2d55` / `#9d4edd` (Hostile vectors, boss weak points)
  - Emerald Alliance: `#10b981` (Node health, preserved status)
- **Typography & Hierarchy**:
  - Display & Headlines: `Plus Jakarta Sans` / `Outfit` (bold, tracking-wide)
  - Data & Telemetry: `JetBrains Mono` / `Space Mono` (`tabular-nums`, clean unboxed metadata)
  - Zero-pill compliance: Clean text metadata separated by `·` or `/`, no static candy badges or fake compiler clutter.
- **Component Styling & Layout**:
  - Central 3D viewport remains 100% unobstructed.
  - Sleek collapsible bottom dock for Totem selection and special abilities.
  - Perimeter HUD hugging screen edges with real-time radar, node status, and chapter objective markers.
  - Boss health bar positioned in top-center with distinct segment breaks for health phases.

#### Interactive Feedback & Motion
- **Volumetric Particle Systems**: Customized `THREE.Points` particle simulations for engine exhaust trails, crystal shard collection, shield impact ripples, and boss explosive disintegrations.
- **Cinematic Camera Choreography**:
  - Smooth camera damping (`THREE.MathUtils.damp`) for tactical chase, orbital sweep during boss entry, and micro FOV kick during hyperspace kinetic dash.
  - Directional hitstop pauses (40–80ms) and camera screenshake on heavy impacts.

---

### 3. Key Product Decisions & Trade-Offs

#### Decision 1: Boss Encounter Architecture & Phase States
- *Chosen Approach*: State-driven boss entities (`BossActor`) with distinct combat phases (Phase 1: Escort barrage, Phase 2: Rotating beam lasers & shield overdrive, Phase 3: Corrupted singularity bursts) with explicit telegraphing.
- *Why*: Delivers high-stakes combat encounters with clear telegraphs, rewarding reactive positioning over pure stat checks.
- *Alternatives Considered*: Simple damage sponges with scaled health, rejected for lack of tactical engagement.

#### Decision 2: Volumetric Particle Performance & Zero GC
- *Chosen Approach*: Reusable pre-allocated typed buffer arrays (`Float32Array`) and instanced point geometries with modular velocity update loops.
- *Why*: Guarantees rock-solid 60 FPS on high-DPI displays without triggering garbage collection pauses in the render loop.
- *Alternatives Considered*: Instantiating particle meshes per explosion, rejected due to memory churn and frame drops.

#### Decision 3: Campaign Progression & Local Storage State
- *Chosen Approach*: Lightweight persistent campaign store tracking unlocked chapters, high scores, sovereign nodes preserved, and best completion times in `localStorage`.
- *Why*: Allows instant pickup-and-play without requiring backend login infrastructure while giving players clear goals and replayability.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REACT APPLICATION ROOT                            │
│                                 (App.tsx)                                   │
└───────────────┬─────────────────────────────────────────────┬───────────────┘
                │                                             │
      ┌─────────▼─────────┐                         ┌─────────▼─────────┐
      │  GAME CONTROLLER  │◄───────────────────────►│ THREE.JS GAME SCENE│
      │(GameController.ts)│  Kinematics / Telemetry │(ThreeGameScene.ts)│
      └─────────┬─────────┘                         └─────────┬─────────┘
                │ State updates                               │ WebGL Rendering
   ┌────────────┼────────────────────────┐                    │
   ▼            ▼                        ▼                    ▼
┌───────┐ ┌───────────────┐ ┌──────────────────────┐ ┌───────────────────┐
│Title &│ │ Perimeter HUD │ │ Bottom Control Dock  │ │ Cinematic Camera  │
│Campaign│ │(Radar/Threat) │ │ (Totems & Abilities) │ │ & Particle Engine │
│Select │ └───────────────┘ └──────────────────────┘ └───────────────────┘
└───────┘
```

#### Component & Entity Responsibilities:
1. **`src/types/game.ts`**:
   - `ChapterConfig`: Chapter ID, title, lore brief, regional node targets, wave counts, and boss specifications.
   - `BossActor`: Multi-phase state (`ENTERING`, `PHASE_1`, `PHASE_2`, `PHASE_3`, `DEFEATED`), shield generators, attack timers, telegraph markers, and health thresholds.
   - `CampaignProgress`: Current chapter, unlocked chapters, stars/accolades, and highest wave reached.
2. **`src/data/campaignData.ts`**:
   - Complete configuration for Chapters 1 through 4:
     - **Chapter 1: Gulf Shield**: Introductory hostile waves culminating in the *Corruptor Dreadnought Sovereign*.
     - **Chapter 2: Red Sea Axis**: Fast interceptor swarms ending with the twin-core *Resonant Singularity Leviathan*.
     - **Chapter 3: Mediterranean Corridor**: Heavy armor disruptor siege leading to the *Aegis Fortress Dreadnought*.
     - **Chapter 4: Mukaab Apex**: The ultimate sovereign trial against the *Mukaab Apex Colossus* with multi-ring laser grids.
3. **`src/game/three/ThreeGameScene.ts`**:
   - Enhanced cinematic camera controller with modes: `CHASE`, `BOSS_INTRO`, `TACTICAL_OVERVIEW`, `ORBIT`.
   - Volumetric particle emitter pools for laser impacts, shield flashes, missile trails, and boss death shockwaves.
   - Boss procedural 3D models composed of 6–10 articulated parts (core chassis, rotating shield rings, glowing plasma vents).
4. **`src/game/GameController.ts`**:
   - Campaign loop management, boss phase transitions, telegraph hit detection, and dynamic telemetry generation.
5. **UI Layer (`src/components/`)**:
   - `CampaignSelectModal`: Chapter selector displaying sovereign realm nodes and accolades.
   - `BossStatusBar`: Cinematic health bar with phase markers and telegraph warnings at the top of the HUD.
   - `PerimeterHud` & `BottomControlDock`: Enhanced with chapter progress and active boss status.

---

### Verification Plan

1. **Compilation Check**: Run `compile_applet` to verify clean TypeScript compilation with zero errors.
2. **Gameplay Lifecycle Verification**:
   - Title screen navigation into Chapter 1 campaign start.
   - Wave progression, hostile enemy targeting, and smooth player controls (WASD/Arrows + Mouse aim + Space/Click).
   - Boss trigger at final wave of chapter, verifying cinematic camera pan and phase transitions.
   - Volumetric particle explosion and chapter completion transition.
3. **UI Responsiveness & Audio**:
   - Test Totem abilities (A–G), bottom dock collapse/expand, and synthesizer audio feedback.
