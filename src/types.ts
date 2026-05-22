export enum ShellType {
  AP = "AP",
  APCBC = "APCBC",
  APCR = "APCR",
  APDS = "APDS"
}

export interface ShellTypeConfig {
  name: string;
  description: string;
  dRef: number;      // Reference caliber (mm)
  mRef: number;      // Reference mass (kg)
  vRef: number;      // Reference velocity (m/s)
  pRef: number;      // Reference penetration (mm) at 0 degrees
}

export const SHELL_TYPE_CONFIGS: Record<ShellType, ShellTypeConfig> = {
  [ShellType.AP]: {
    name: "AP/APHE/APBC (普通空心/实心穿甲弹)",
    description: "常规无被帽穿甲弹或钝头穿甲弹，对垂直装甲表现极佳，但对大倾角倾斜装甲侵彻力衰减较快，易于发生跳弹。",
    dRef: 75,
    mRef: 6.3,
    vRef: 853,
    pRef: 116
  },
  [ShellType.APCBC]: {
    name: "APCBC/APC (被帽风帽穿甲弹)",
    description: "带有韧性钢被帽以保护弹头并在接触倾斜表面时“转正”，附加风帽以改善气动特性。对倾斜装甲等效侵彻性极佳。",
    dRef: 75,
    mRef: 6.53,
    vRef: 619,
    pRef: 90
  },
  [ShellType.APCR]: {
    name: "APCR/HVAP (硬芯穿甲弹/高速穿甲弹)",
    description: "小口径致密钨硬芯外包轻金属护套，初速极高，近距离对薄而平直的装甲有绝佳穿深。但侵彻阻力随倾角增加呈指数级急剧恶化，极易滑弹。",
    dRef: 37,
    mRef: 0.5,
    vRef: 1030,
    pRef: 110
  },
  [ShellType.APDS]: {
    name: "APDS (脱壳穿甲弹 - 钨合金芯)",
    description: "发射后分离外壳以最大化长径比和截面弹道比，其钨合金弹芯较重且极硬。具备极好的中远距离射程和卓越的抗倾斜装甲侵彻能力。",
    dRef: 76.2, // core caliber is used in WT relative calculation proportionally
    mRef: 1.48, // core mass weight is standard
    vRef: 1204,
    pRef: 228
  }
};

export interface GunPreset {
  id: string;
  name: string;
  country: string;
  caliber: number;      // mm
  mass: number;         // kg
  velocity: number;     // m/s
  type: ShellType;
  historicalPen: number; // mm at muzzle (empirical real-world or standard)
  era: string;          // WW2 or post-war
}

export const GUN_PRESETS: GunPreset[] = [
  {
    id: "us_75mm_m3",
    name: "M3型 75毫米坦克炮 (谢尔曼 M4 早期型)",
    country: "USA",
    caliber: 75,
    mass: 6.53,
    velocity: 619,
    type: ShellType.APCBC,
    historicalPen: 90,
    era: "二战早期"
  },
  {
    id: "german_75mm_kwk40",
    name: "KwK40 L/48 75毫米长管炮 (四号坦克 H型)",
    country: "Germany",
    caliber: 75,
    mass: 6.8,
    velocity: 740,
    type: ShellType.APCBC,
    historicalPen: 135,
    era: "二战中期"
  },
  {
    id: "german_88mm_kwk36",
    name: "KwK36 L/56 88毫米坦克炮 (虎式 I型)",
    country: "Germany",
    caliber: 88,
    mass: 10.2,
    velocity: 773,
    type: ShellType.APCBC,
    historicalPen: 162,
    era: "二战中期"
  },
  {
    id: "german_88mm_kwk43",
    name: "KwK43 L/71 88毫米长管炮 (虎王 / 斐迪南)",
    country: "Germany",
    caliber: 88,
    mass: 10.2,
    velocity: 1000,
    type: ShellType.APCBC,
    historicalPen: 232,
    era: "二战后期"
  },
  {
    id: "ussr_85mm_zis53",
    name: "ZiS-S-53 85毫米坦克炮 (T-34-85)",
    country: "USSR",
    caliber: 85,
    mass: 9.2,
    velocity: 792,
    type: ShellType.AP, // BR-365A APHEBC is categorized as AP by Gaijin exponents
    historicalPen: 135,
    era: "二战中后期"
  },
  {
    id: "ussr_122mm_d25t",
    name: "D-25T 122毫米重型坦克炮 (斯大林 IS-2)",
    country: "USSR",
    caliber: 122,
    mass: 25.0,
    velocity: 800,
    type: ShellType.AP, // Soviet heavy blunt-nose APHEBC
    historicalPen: 205,
    era: "二战后期"
  },
  {
    id: "us_90mm_m3",
    name: "M3型 90毫米高平两用炮 (潘兴 M26)",
    country: "USA",
    caliber: 90,
    mass: 10.91,
    velocity: 807,
    type: ShellType.APCBC,
    historicalPen: 165,
    era: "二战后期"
  },
  {
    id: "uk_17pdr_mk8",
    name: "QF 17磅 76.2毫米反坦克炮 (萤火虫/阿喀琉斯)",
    country: "UK",
    caliber: 76.2,
    mass: 7.7,
    velocity: 884,
    type: ShellType.APCBC,
    historicalPen: 171,
    era: "二战后期"
  },
  {
    id: "uk_17pdr_apds",
    name: "QF 17磅 脱壳合金芯穿甲弹 (APDS 弹型)",
    country: "UK",
    caliber: 76.2, // Subcaliber sabot
    mass: 1.48, // core mass only
    velocity: 1204,
    type: ShellType.APDS,
    historicalPen: 228,
    era: "二战后期/冷战早期"
  },
  {
    id: "german_37mm_pak36",
    name: "PaK36 L/45 37毫米反坦克炮 (APCR 敲门砖/早期型)",
    country: "Germany",
    caliber: 37,
    mass: 0.36,
    velocity: 1020,
    type: ShellType.APCR,
    historicalPen: 86,
    era: "二战早期"
  },
  {
    id: "ussr_152mm_ml20",
    name: "ML-20S 152毫米重型榴弹炮 (神教 ISU-152 穿甲弹型)",
    country: "USSR",
    caliber: 152.4,
    mass: 48.78,
    velocity: 600,
    type: ShellType.AP,
    historicalPen: 175,
    era: "二战后期"
  }
];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
