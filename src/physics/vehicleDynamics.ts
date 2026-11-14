import { H2_LHV_KWH_PER_KG, clampValue } from './electrolysis';

export const AIR_DENSITY_KG_M3 = 1.225; // Standard sea-level dry air at 15 °C
export const GRAVITY_MS2 = 9.81;

export interface VehicleDynamicsInput {
  vehicleMassKg: number;
  speedKmh: number;
  frontalAreaM2: number;
  dragCoefficient: number;
  rollingResistanceCoeff: number;
  roadGradientPercent: number; // % grade = 100 * tan(theta)
  accelerationMs2: number;
  fuelCellEfficiency: number; // fraction
  powerElectronicsEfficiency: number; // fraction
  motorEfficiency: number; // fraction
  drivetrainEfficiency: number; // fraction
  fuelCellMaxPowerKW: number;
  tankCapacityKg: number;
  availableHydrogenKg: number;
  regenCaptureFraction: number; // fraction of braking wheel power recoverable into buffer battery (0..0.65)
  maxRegenPowerKW: number;
}

export interface VehicleDynamicsResult {
  speedMs: number;
  slopeAngleDeg: number;
  forcesN: {
    aerodynamicDrag: number;
    rollingResistance: number;
    gradeResistance: number;
    acceleration: number;
    totalTractive: number;
  };
  wheelPowerKW: number;
  electricalMotorInputKW: number;
  fuelCellElectricalDemandKW: number;
  batteryAssistKW: number; // transient battery discharge when demand exceeds FC rating
  regenRecoveredKW: number; // captured into buffer battery on negative tractive demand
  hydrogenChemicalPowerKW: number;
  fuelCellHeatLossKW: number;
  hydrogenRateKgPerHour: number;
  h2ConsumptionKgPer100Km: number;
  tankEnergyKWhPer100Km: number;
  wheelEnergyKWhPer100Km: number;
  estimatedRangeKm: number;
  tankFillPercent: number;
  isPowerLimited: boolean;
  isRegenerating: boolean;
}

export const DEFAULT_VEHICLE_DYNAMICS_INPUT: VehicleDynamicsInput = {
  vehicleMassKg: 1850,
  speedKmh: 90,
  frontalAreaM2: 2.38,
  dragCoefficient: 0.27,
  rollingResistanceCoeff: 0.0095,
  roadGradientPercent: 0,
  accelerationMs2: 0,
  fuelCellEfficiency: 0.56,
  powerElectronicsEfficiency: 0.96,
  motorEfficiency: 0.92,
  drivetrainEfficiency: 0.95,
  fuelCellMaxPowerKW: 115,
  tankCapacityKg: 5.6,
  availableHydrogenKg: 4.8,
  regenCaptureFraction: 0.55,
  maxRegenPowerKW: 45,
};

export function calculateVehicleDynamics(raw: VehicleDynamicsInput): VehicleDynamicsResult {
  const mass = clampValue(raw.vehicleMassKg, 800, 45000);
  const speedKmh = clampValue(raw.speedKmh, 0, 220);
  const frontalArea = clampValue(raw.frontalAreaM2, 1.2, 10);
  const cd = clampValue(raw.dragCoefficient, 0.18, 1.1);
  const crr = clampValue(raw.rollingResistanceCoeff, 0.004, 0.03);
  const gradientPct = clampValue(raw.roadGradientPercent, -15, 15);
  const accel = clampValue(raw.accelerationMs2, -4, 4);

  const etaFc = clampValue(raw.fuelCellEfficiency, 0.30, 0.75);
  const etaPe = clampValue(raw.powerElectronicsEfficiency, 0.75, 0.99);
  const etaMotor = clampValue(raw.motorEfficiency, 0.70, 0.98);
  const etaDrive = clampValue(raw.drivetrainEfficiency, 0.75, 0.99);

  const fcMaxKW = clampValue(raw.fuelCellMaxPowerKW, 20, 400);
  const tankCapacityKg = clampValue(raw.tankCapacityKg, 1, 80);
  const availableHydrogenKg = clampValue(raw.availableHydrogenKg, 0, tankCapacityKg);
  const regenFrac = clampValue(raw.regenCaptureFraction, 0, 0.65);
  const maxRegenKW = clampValue(raw.maxRegenPowerKW, 0, 150);

  const speedMs = speedKmh / 3.6;
  const slopeRad = Math.atan(gradientPct / 100);
  const slopeAngleDeg = (slopeRad * 180) / Math.PI;

  const aerodynamicDrag = 0.5 * AIR_DENSITY_KG_M3 * cd * frontalArea * speedMs * speedMs;
  const rollingResistance = speedMs > 0.01 ? crr * mass * GRAVITY_MS2 * Math.cos(slopeRad) : 0;
  const gradeResistance = mass * GRAVITY_MS2 * Math.sin(slopeRad);
  const accelerationForce = mass * accel;

  const totalTractive = aerodynamicDrag + rollingResistance + gradeResistance + accelerationForce;
  const wheelPowerKW = (totalTractive * speedMs) / 1000;

  const electricTrainEff = etaPe * etaMotor * etaDrive;
  let electricalMotorInputKW = 0;
  let fuelCellElectricalDemandKW = 0;
  let batteryAssistKW = 0;
  let regenRecoveredKW = 0;
  let hydrogenChemicalPowerKW = 0;
  let fuelCellHeatLossKW = 0;
  let isPowerLimited = false;
  let isRegenerating = false;

  if (wheelPowerKW > 0.001 && availableHydrogenKg > 0) {
    electricalMotorInputKW = wheelPowerKW / (etaMotor * etaDrive);
    const totalBusDemandKW = wheelPowerKW / electricTrainEff;
    fuelCellElectricalDemandKW = Math.min(totalBusDemandKW, fcMaxKW);
    batteryAssistKW = Math.max(0, totalBusDemandKW - fcMaxKW);
    isPowerLimited = batteryAssistKW > 25; // Illustrative buffer battery discharge limit
    hydrogenChemicalPowerKW = fuelCellElectricalDemandKW / etaFc;
    fuelCellHeatLossKW = hydrogenChemicalPowerKW - fuelCellElectricalDemandKW;
  } else if (wheelPowerKW < -0.001 && speedMs > 0.1) {
    isRegenerating = true;
    const rawRegenPotentialKW = Math.abs(wheelPowerKW) * electricTrainEff * regenFrac;
    regenRecoveredKW = Math.min(maxRegenKW, rawRegenPotentialKW);
  }

  const hydrogenRateKgPerHour = hydrogenChemicalPowerKW / H2_LHV_KWH_PER_KG;

  const h2ConsumptionKgPer100Km =
    speedKmh > 1 && hydrogenRateKgPerHour > 0 ? (hydrogenRateKgPerHour / speedKmh) * 100 : 0;
  const tankEnergyKWhPer100Km = h2ConsumptionKgPer100Km * H2_LHV_KWH_PER_KG;
  const wheelEnergyKWhPer100Km =
    speedKmh > 1 && wheelPowerKW > 0 ? (wheelPowerKW / speedKmh) * 100 : 0;

  const estimatedRangeKm =
    h2ConsumptionKgPer100Km > 0.01 ? (availableHydrogenKg / h2ConsumptionKgPer100Km) * 100 : 0;

  return {
    speedMs,
    slopeAngleDeg,
    forcesN: {
      aerodynamicDrag,
      rollingResistance,
      gradeResistance,
      acceleration: accelerationForce,
      totalTractive,
    },
    wheelPowerKW,
    electricalMotorInputKW,
    fuelCellElectricalDemandKW,
    batteryAssistKW,
    regenRecoveredKW,
    hydrogenChemicalPowerKW,
    fuelCellHeatLossKW,
    hydrogenRateKgPerHour,
    h2ConsumptionKgPer100Km,
    tankEnergyKWhPer100Km,
    wheelEnergyKWhPer100Km,
    estimatedRangeKm,
    tankFillPercent: (availableHydrogenKg / tankCapacityKg) * 100,
    isPowerLimited,
    isRegenerating,
  };
}

export function generatePowerSpeedCurve(
  baseInput: VehicleDynamicsInput,
  speedsKmh: number[] = [0, 20, 40, 60, 80, 100, 120, 140, 160],
): Array<{ speedKmh: number; wheelPowerKW: number; h2PowerKW: number; h2Per100Km: number }> {
  return speedsKmh.map((speedKmh) => {
    const res = calculateVehicleDynamics({
      ...baseInput,
      speedKmh,
      accelerationMs2: 0, // Steady-state cruise curve
    });
    return {
      speedKmh,
      wheelPowerKW: res.wheelPowerKW,
      h2PowerKW: res.hydrogenChemicalPowerKW,
      h2Per100Km: res.h2ConsumptionKgPer100Km,
    };
  });
}

export function generateRangeCapacityCurve(
  baseInput: VehicleDynamicsInput,
  capacitiesKg: number[] = [2, 3, 4, 5, 5.6, 6.5, 8, 10],
): Array<{ capacityKg: number; rangeKm: number }> {
  return capacitiesKg.map((cap) => {
    const res = calculateVehicleDynamics({
      ...baseInput,
      tankCapacityKg: cap,
      availableHydrogenKg: cap,
      accelerationMs2: 0,
    });
    return {
      capacityKg: cap,
      rangeKm: res.estimatedRangeKm,
    };
  });
}
