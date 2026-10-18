import { CampaignProgress, ChapterConfig, ChapterId } from '../types/game';

export const CAMPAIGN_CHAPTERS: Record<ChapterId, ChapterConfig> = {
  1: {
    id: 1,
    code: 'CAPÍTULO I',
    title: 'Arabian Gulf Sanctuary',
    subtitle: 'Outer Perimeter Shield Reconnection',
    sectorName: 'SECTOR-01 // ARABIAN BASIN',
    threatLevel: 'TACTICAL AMBER',
    description: 'Hostile anomalies attempt to sever the primary Gulf communication beacons. Reconnect the Riyadh Core and defend the regional alliance relays.',
    ambientColor: 0x07090e,
    fogDensity: 0.012,
    realmNodes: ['node-sa', 'node-ae', 'node-qa', 'node-kw', 'node-bh', 'node-om'],
    totalWaves: 3,
    boss: {
      id: 'boss-ch1',
      name: 'Malphas Dreadnought',
      title: 'MALPHAS DREADNOUGHT SOVEREIGN',
      subtitle: 'Class IV Corrupted Orbital Cruiser',
      maxHealth: 1600,
      phases: 2,
      color: '#ff3366',
      accentColor: '#ff9900',
      abilities: ['Rotating Plasma Spikes', 'Swarmer Ejection Bay', 'Hull Breach Kinetic Pulse'],
    },
  },
  2: {
    id: 2,
    code: 'CAPÍTULO II',
    title: 'Red Sea Orbital Axis',
    subtitle: 'Maritime Resonant Rift Defense',
    sectorName: 'SECTOR-02 // RED SEA BASIN',
    threatLevel: 'CRITICAL CRIMSON',
    description: 'Sub-space tears detected near the maritime passage. Hostiles seek to drain the 460,000E Nilotic reserves across Jeddah and Cairo relays.',
    ambientColor: 0x0a0c16,
    fogDensity: 0.014,
    realmNodes: ['node-eg', 'node-jo', 'node-sd', 'node-dj', 'node-er'],
    totalWaves: 4,
    boss: {
      id: 'boss-ch2',
      name: 'Ouroboros Leviathan',
      title: 'OUROBOROS VOID SINGULARITY LEVIATHAN',
      subtitle: 'Class V Bio-Mechanical Graviton Core',
      maxHealth: 2400,
      phases: 2,
      color: '#9d4edd',
      accentColor: '#00f0ff',
      abilities: ['Graviton Vortex Pull', 'Antimatter Arc Sweep', 'Singularity Pulse Blast'],
    },
  },
  3: {
    id: 3,
    code: 'CAPÍTULO III',
    title: 'Mediterranean Resonant Corridor',
    subtitle: 'Levantine Alliance Stronghold',
    sectorName: 'SECTOR-03 // MEDITERRANEAN CREST',
    threatLevel: 'EXTREME ULTRA-VIOLET',
    description: 'High-density armored disruptors swarm the northern perimeter. Coordinate with Caschi Gialli drones and deploy Totem C Aegis deflector fields.',
    ambientColor: 0x08101a,
    fogDensity: 0.013,
    realmNodes: ['node-tr', 'node-lb', 'node-sy', 'node-cy', 'node-gr'],
    totalWaves: 4,
    boss: {
      id: 'boss-ch3',
      name: 'Colossus Aegis Fortress',
      title: 'COLOSSUS AEGIS FORTRESS DREADNOUGHT',
      subtitle: 'Class VI Armored Bastion Flagship',
      maxHealth: 3400,
      phases: 3,
      color: '#00f0ff',
      accentColor: '#ff0055',
      abilities: ['Kinetic Deflector Ward', 'Triple High-Energy Lances', 'Cluster Ion Torpedoes'],
    },
  },
  4: {
    id: 4,
    code: 'CAPÍTULO IV',
    title: 'Mukaab Apex Citadel',
    subtitle: 'The 221-Realm Sovereign Zenith',
    sectorName: 'SECTOR-04 // ZENITH MUKAAB CORE',
    threatLevel: 'MAXIMUM OVERLOAD [Φ = 1.618]',
    description: 'The epicenter of Murabba. The Golden Tesseract anomaly threatens the entire 221 sovereign alliance grid. Channel all 7 Totems to claim ultimate victory.',
    ambientColor: 0x0d0a14,
    fogDensity: 0.015,
    realmNodes: ['node-mukaab', 'node-sa', 'node-ae', 'node-eg', 'node-all221'],
    totalWaves: 5,
    boss: {
      id: 'boss-ch4',
      name: 'The Golden Tesseract',
      title: 'THE GOLDEN TESSERACT APEX OVERLORD',
      subtitle: 'Multidimensional Mathematical Anomaly',
      maxHealth: 5000,
      phases: 3,
      color: '#ffd978',
      accentColor: '#ffe600',
      abilities: ['Golden Grid Annihilation Beam', 'Corrupted Totem Replicas', 'Dimensional Collapse Wave'],
    },
  },
};

const CAMPAIGN_STORAGE_KEY = 'snbv_campaign_progress_v2';

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.unlockedChapters && Array.isArray(parsed.unlockedChapters)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse campaign progress, resetting', err);
  }

  // Initial Default: Chapter 1 unlocked
  return {
    unlockedChapters: [1],
    chapterRecords: {
      1: { stars: 0, highScore: 0, nodesPreserved: 0, bestTimeSeconds: 0 },
      2: { stars: 0, highScore: 0, nodesPreserved: 0, bestTimeSeconds: 0 },
      3: { stars: 0, highScore: 0, nodesPreserved: 0, bestTimeSeconds: 0 },
      4: { stars: 0, highScore: 0, nodesPreserved: 0, bestTimeSeconds: 0 },
    },
  };
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Failed to save campaign progress', err);
  }
}

export function recordChapterCompletion(
  chapterId: ChapterId,
  score: number,
  nodesPreserved: number,
  timeSeconds: number
): { progress: CampaignProgress; newlyUnlocked: ChapterId | null; starsEarned: number } {
  const current = loadCampaignProgress();

  // Calculate stars (1 star for completing, 2 stars for score > 15,000, 3 stars for all nodes intact)
  let starsEarned = 1;
  if (score >= 12000) starsEarned++;
  if (nodesPreserved >= 210) starsEarned++;

  const prevRecord = current.chapterRecords[chapterId] || {
    stars: 0,
    highScore: 0,
    nodesPreserved: 0,
    bestTimeSeconds: 0,
  };

  current.chapterRecords[chapterId] = {
    stars: Math.max(prevRecord.stars, starsEarned),
    highScore: Math.max(prevRecord.highScore, score),
    nodesPreserved: Math.max(prevRecord.nodesPreserved, nodesPreserved),
    bestTimeSeconds:
      prevRecord.bestTimeSeconds === 0 ? timeSeconds : Math.min(prevRecord.bestTimeSeconds, timeSeconds),
  };

  // Unlock next chapter if not unlocked
  let newlyUnlocked: ChapterId | null = null;
  const nextChapter = (chapterId + 1) as ChapterId;
  if (chapterId < 4 && !current.unlockedChapters.includes(nextChapter)) {
    current.unlockedChapters.push(nextChapter);
    newlyUnlocked = nextChapter;
  }

  saveCampaignProgress(current);
  return { progress: current, newlyUnlocked, starsEarned };
}
