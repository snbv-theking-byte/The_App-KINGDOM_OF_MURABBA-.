/**
 * Kingdom of Murabba - Structured Symbolic Worldbuilding Manifesto
 * Provides the configuration layer for Identity, Pillars, Elite Guards, and Sovereign Scope.
 */

export interface ManifestoPillar {
  id: string;
  name: string;
  title: string;
  description: string;
  color: string;
  accent: string;
  gameModifier: string;
  iconSymbol: string;
}

export interface ManifestoConfig {
  identity: {
    token: string;
    codename: string;
    authority: string;
    holder: string;
  };
  symbolism: {
    constantName: string;
    constantValue: number;
    formula: string;
    slackPort: string;
  };
  realm: {
    name: string;
    capital: string;
    scaleDescription: string;
    architecturalNexus: string;
  };
  eliteGuard: {
    name: string;
    unit: string;
    motto: string;
    insigniaColor: string;
    escortType: string;
  };
  scope: {
    totalNations: number;
    primaryCoalition: string[];
    defenseGridStatus: string;
  };
  pillars: ManifestoPillar[];
}

export const MANIFESTO_CONFIG: ManifestoConfig = {
  identity: {
    token: 'SNBV™',
    codename: 'CHEk0 Berlanga™',
    authority: 'FIELD MARSHAL SUPREMO',
    holder: 'SERGIO NICOLÁS BERLANGA VILLARREAL™',
  },
  symbolism: {
    constantName: 'Φ (Golden Ratio)',
    constantValue: 1.618036,
    formula: 'Φ = 1.618036 [http://kingofmurabba.slack.com 320 } ]',
    slackPort: 'kingofmurabba.slack.com:320',
  },
  realm: {
    name: 'KINGDOM OF MURABBA™',
    capital: 'Riyadh Prime Nexus',
    scaleDescription: '400M Cubic Sovereign Matrix',
    architecturalNexus: 'The Golden Mukaab',
  },
  eliteGuard: {
    name: 'GUARDIA D\'ÈLITE MURABBA™',
    unit: 'CASCHI GIALLI™',
    motto: 'DEFENSA PERPETUA DE LA SOBERANÍA',
    insigniaColor: '#ffe600',
    escortType: 'Dual Autonomous Tactical Interceptors',
  },
  scope: {
    totalNations: 221,
    primaryCoalition: [
      'Kingdom of Saudi Arabia',
      'United Arab Emirates',
      'Kingdom of Egypt',
      'Global Commonwealth of 221 Realms',
    ],
    defenseGridStatus: 'SOVEREIGN SYNCHRONIZED',
  },
  pillars: [
    {
      id: 'pillar-monarquia',
      name: 'MONARQUÍA',
      title: 'Supreme Sovereign Command',
      description: 'Unshakeable dynastic defense authority and central command core stability.',
      color: '#ffd978',
      accent: '#dfb15b',
      gameModifier: '+20% Hull & Shield Durability Across All Sectors',
      iconSymbol: '👑',
    },
    {
      id: 'pillar-influencia',
      name: 'INFLUENCIA',
      title: 'Global Alliance Mesh',
      description: 'Synchronized telemetry across 221 sovereign realms with zero signal degradation.',
      color: '#00f0ff',
      accent: '#00b4d8',
      gameModifier: 'Automatic Radar Warning Uplink & Fast Tactical Targeting',
      iconSymbol: '🌐',
    },
    {
      id: 'pillar-tecnologia',
      name: 'TECNOLOGÍA',
      title: 'Mukaab Harmonic Matrix',
      description: 'Golden-ratio plasma emitters, gyroscopic deflector wards, and orbital lances.',
      color: '#ffe600',
      accent: '#9d4edd',
      gameModifier: 'Overcharged Double/Triple Lasers and Φ-Wave Detonation',
      iconSymbol: '⚡',
    },
    {
      id: 'pillar-dinero',
      name: 'DINERO',
      title: '460,000E Sovereign Reserves',
      description: 'Pure energetic capital reserves fueling super-weapons and defense infrastructure.',
      color: '#10b981',
      accent: '#059669',
      gameModifier: 'Accelerated Crystal Shard Magnetism & Score Multipliers',
      iconSymbol: '💎',
    },
  ],
};
