import { EnergyChainInput, calculateEnergyChain } from './energyChain';
import { clampValue } from './electrolysis';

export interface BevAssumptions {
  gridAndChargerEfficiency: number; // AC transmission + onboard/DC fast charger (fraction)
  batteryRoundTripEfficiency: number; // Li-ion charge + discharge coulombic/internal resistance
  powerElectronicsEfficiency: number;
  motorEfficiency: number;
  drivetrainEfficiency: number;
}

export const DEFAULT_BEV_ASSUMPTIONS: BevAssumptions = {
  gridAndChargerEfficiency: 0.91,
  batteryRoundTripEfficiency: 0.90,
  powerElectronicsEfficiency: 0.96,
  motorEfficiency: 0.92,
  drivetrainEfficiency: 0.95,
};

export interface PathwayComparisonResult {
  inputEnergyKWh: number;
  fcev: {
    overallEfficiencyPct: number;
    wheelEnergyKWh: number;
    totalLossesKWh: number;
    stages: Array<{ label: string; remainingKWh: number; lossKWh: number }>;
  };
  bev: {
    overallEfficiencyPct: number;
    wheelEnergyKWh: number;
    totalLossesKWh: number;
    stages: Array<{ label: string; remainingKWh: number; lossKWh: number }>;
  };
  relativeRatioBevToFcev: number;
}

export function compareFcevVsBev(
  fcevInput: EnergyChainInput,
  bevRaw: BevAssumptions = DEFAULT_BEV_ASSUMPTIONS,
): PathwayComparisonResult {
  const fcevRes = calculateEnergyChain(fcevInput);
  const eIn = fcevRes.inputEnergyKWh;

  const etaGrid = clampValue(bevRaw.gridAndChargerEfficiency, 0.70, 0.99);
  const etaBatt = clampValue(bevRaw.batteryRoundTripEfficiency, 0.70, 0.99);
  const etaPe = clampValue(bevRaw.powerElectronicsEfficiency, 0.75, 0.99);
  const etaMotor = clampValue(bevRaw.motorEfficiency, 0.70, 0.98);
  const etaDrive = clampValue(bevRaw.drivetrainEfficiency, 0.75, 0.99);

  const eCharged = eIn * etaGrid;
  const eBatteryOut = eCharged * etaBatt;
  const ePe = eBatteryOut * etaPe;
  const eMotor = ePe * etaMotor;
  const eWheels = eMotor * etaDrive;

  const bevOverall = eWheels / eIn;
  const fcevOverall = fcevRes.boundaries.electricityToWheels;

  return {
    inputEnergyKWh: eIn,
    fcev: {
      overallEfficiencyPct: fcevOverall * 100,
      wheelEnergyKWh: fcevRes.wheelMechanicalKWh,
      totalLossesKWh: fcevRes.totalLossesKWh,
      stages: fcevRes.stages.map((s) => ({
        label: s.shortLabel,
        remainingKWh: s.energyOutKWh,
        lossKWh: s.lossKWh,
      })),
    },
    bev: {
      overallEfficiencyPct: bevOverall * 100,
      wheelEnergyKWh: eWheels,
      totalLossesKWh: eIn - eWheels,
      stages: [
        { label: 'Charger & Grid', remainingKWh: eCharged, lossKWh: eIn - eCharged },
        { label: 'Li-ion Battery', remainingKWh: eBatteryOut, lossKWh: eCharged - eBatteryOut },
        { label: 'Inverter', remainingKWh: ePe, lossKWh: eBatteryOut - ePe },
        { label: 'Electric Motor', remainingKWh: eMotor, lossKWh: ePe - eMotor },
        { label: 'Drivetrain', remainingKWh: eWheels, lossKWh: eMotor - eWheels },
      ],
    },
    relativeRatioBevToFcev: fcevOverall > 0 ? bevOverall / fcevOverall : 0,
  };
}
