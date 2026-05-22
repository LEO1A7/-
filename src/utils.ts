import { ShellType, ShellTypeConfig, SHELL_TYPE_CONFIGS } from "./types";

// 1. Calculate War Thunder relative De Marre penetration at 0 degrees
export function calculateDeMarreWT(
  caliber: number, // mm
  mass: number,    // kg
  velocity: number, // m/s
  shellType: ShellType
): number {
  const config = SHELL_TYPE_CONFIGS[shellType];
  
  // Guard against non-positive inputs
  if (caliber <= 0 || mass <= 0 || velocity <= 0) return 0;

  // De Marre WT formula:
  // P_calc = P_ref * (M_calc/M_ref)^0.714285 * (V_calc/V_ref)^1.42857 * (D_ref/D_calc)^1.071428
  const mTerm = Math.pow(mass / config.mRef, 0.714285);
  const vTerm = Math.pow(velocity / config.vRef, 1.42857);
  const dTerm = Math.pow(config.dRef / caliber, 1.071428);

  const rawPen = config.pRef * mTerm * vTerm * dTerm;
  return Math.round(rawPen * 10) / 10; // Round to 1 decimal place
}

// 2. Get slope multipliers based on angle (degrees from vertical/normal)
// Angle is from normal: 0 deg means vertical hitting, 60 deg is sloped back 60 degrees.
export function getSlopeMultiplier(angleDegrees: number, shellType: ShellType): number {
  const angle = Math.max(0, Math.min(80, angleDegrees));

  // Keypoints: [angle, multiplier]
  let keypoints: [number, number][];

  switch (shellType) {
    case ShellType.AP:
      keypoints = [
        [0, 1.0],
        [30, 0.82],
        [45, 0.65],
        [60, 0.43],
        [70, 0.25],
        [80, 0.05],
      ];
      break;
    case ShellType.APCBC:
      keypoints = [
        [0, 1.0],
        [30, 0.86],
        [45, 0.72],
        [60, 0.49],
        [70, 0.32],
        [80, 0.08],
      ];
      break;
    case ShellType.APCR:
      keypoints = [
        [0, 1.0],
        [30, 0.77],
        [45, 0.52],
        [60, 0.28],
        [70, 0.12],
        [80, 0.01],
      ];
      break;
    case ShellType.APDS:
      keypoints = [
        [0, 1.0],
        [30, 0.84],
        [45, 0.71],
        [60, 0.51],
        [70, 0.35],
        [80, 0.10],
      ];
      break;
  }

  // Linear interpolation between keypoints
  for (let i = 0; i < keypoints.length - 1; i++) {
    const [a1, m1] = keypoints[i];
    const [a2, m2] = keypoints[i + 1];
    if (angle >= a1 && angle <= a2) {
      const ratio = (angle - a1) / (a2 - a1);
      return m1 + ratio * (m2 - m1);
    }
  }

  return 0.0;
}

// 3. Range decay estimation
export function getEstimatedVelocityAtRange(
  muzzleVelocity: number, // m/s
  rangeMeters: number,    // m
  shellType: ShellType
): number {
  if (muzzleVelocity <= 0) return 0;
  
  // Drag coefficients
  let k = 0.00012; // default
  if (shellType === ShellType.AP) k = 0.00014;       // medium aerodynamic drag
  else if (shellType === ShellType.APCBC) k = 0.00012; // nice ballistic windshield
  else if (shellType === ShellType.APCR) k = 0.00028;  // severe speed loss due to low density core-jacket shape
  else if (shellType === ShellType.APDS) k = 0.00008;  // superb high energy retention sub-projectile

  // Exponential decay
  const velocity = muzzleVelocity * Math.exp(-k * rangeMeters);
  return Math.round(velocity);
}

// 4. Classical metric De Marre Formula Solver
// Formula: V = (C * d^0.05 * t^0.7) / sqrt(m)
// Unit Conversion Helpers (input/output is mm, kg, m/s, but formula uses decimeters (dm) for t and d)
// 1 dm = 100 mm. So t_dm = t_mm / 100, d_dm = d_mm / 100
export interface ClassicalDeMarreInput {
  v: number; // m/s
  m: number; // kg
  d: number; // mm (projectile caliber)
  t: number; // mm (armor thickness penetrated)
  c: number; // Constant
}

export function solveClassicalDeMarre(
  inputs: Partial<ClassicalDeMarreInput>,
  solveFor: keyof ClassicalDeMarreInput
): number {
  const v = inputs.v ?? 0;
  const m = inputs.m ?? 0;
  const d_mm = inputs.d ?? 0;
  const t_mm = inputs.t ?? 0;
  const c = inputs.c ?? 0;

  // convert mm sizes to decimeters (dm)
  const d = d_mm / 100;
  const t = t_mm / 100;

  switch (solveFor) {
    case "v": {
      if (m <= 0 || d <= 0 || t <= 0 || c <= 0) return 0;
      const calculatedV = (c * Math.pow(d, 0.05) * Math.pow(t, 0.7)) / Math.sqrt(m);
      return Math.round(calculatedV * 10) / 10;
    }
    case "t": {
      if (v <= 0 || m <= 0 || d <= 0 || c <= 0) return 0;
      // t^0.7 = (V * sqrt(m)) / (C * d^0.05)
      const t_pow_0_7 = (v * Math.sqrt(m)) / (c * Math.pow(d, 0.05));
      if (t_pow_0_7 <= 0) return 0;
      const t_dm = Math.pow(t_pow_0_7, 1 / 0.7);
      return Math.round(t_dm * 100 * 10) / 10; // back to mm, round 1 decimal
    }
    case "c": {
      if (v <= 0 || m <= 0 || d <= 0 || t <= 0) return 0;
      const calculatedC = (v * Math.sqrt(m)) / (Math.pow(d, 0.05) * Math.pow(t, 0.7));
      return Math.round(calculatedC);
    }
    case "m": {
      if (v <= 0 || d <= 0 || t <= 0 || c <= 0) return 0;
      const sqrtM = (c * Math.pow(d, 0.05) * Math.pow(t, 0.7)) / v;
      return Math.round(Math.pow(sqrtM, 2) * 1000) / 1000; // round to 3 decimals (kg)
    }
    case "d": {
      if (v <= 0 || m <= 0 || t <= 0 || c <= 0) return 0;
      // d^0.05 = (V * sqrt(m)) / (C * t^0.7)
      const d_pow_0_05 = (v * Math.sqrt(m)) / (c * Math.pow(t, 0.7));
      if (d_pow_0_05 <= 0) return 0;
      const d_dm = Math.pow(d_pow_0_05, 20); // 1 / 0.05 = 20
      return Math.round(d_dm * 100 * 10) / 10; // back to mm, round 1 decimal
    }
    default:
      return 0;
  }
}
