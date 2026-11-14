import {
  H2_LHV_KWH_PER_KG,
  STOICH_OXYGEN_KG_PER_KG_H2,
  STOICH_WATER_KG_PER_KG_H2,
  clampValue,
} from './electrolysis';

export interface EnergyChainInput {
  inputEnergyKWh: number; // E_input: external electrical energy supplied to electrolysis
  electrolyzerEfficiency: number; // η_el (fraction)
  conditioningEfficiency: number; // η_condition (compression/transport/dispensing retention)
  fuelCellEfficiency: number; // η_fc (LHV basis, fraction)
  powerElectronicsEfficiency: number; // η_pe (DC/DC + inverter)
  motorEfficiency: number; // η_motor (traction motor)
  drivetrainEfficiency: number; // η_drive (gearbox + axle)
}

export interface EnergyStage {
  id: string;
  label: string;
  shortLabel: string;
  energyInKWh: number;
  energyOutKWh: number;
  lossKWh: number;
  stageEfficiency: number; // fraction
  cumulativeEfficiency: number; // fraction relative to E_input
  colorHex: string;
}

export interface EnergyChainResult {
  inputEnergyKWh: number;
  hydrogenProducedKWh: number;
  hydrogenProducedKg: number;
  storedHydrogenKWh: number;
  storedHydrogenKg: number;
  fuelCellElectricKWh: number;
  powerElectronicsElectricKWh: number;
  motorMechanicalKWh: number;
  wheelMechanicalKWh: number;
  totalLossesKWh: number;
  // Stage-by-stage losses
  losses: {
    electrolyzerKWh: number;
    conditioningKWh: number;
    fuelCellKWh: number;
    powerElectronicsKWh: number;
    motorKWh: number;
    drivetrainKWh: number;
  };
  // System boundary efficiencies (fractions 0..1)
  boundaries: {
    electricityToHydrogen: number;
    hydrogenToElectricity: number; // stored H2 -> DC/AC electrical bus (η_fc * η_pe)
    fuelCellStackOnly: number; // η_fc
    tankToWheels: number; // η_fc * η_pe * η_motor * η_drive
    electricityToWheels: number; // E_wheels / E_input
  };
  // On-board reaction byproducts for stored H2 consumed
  onBoardByproducts: {
    oxygenConsumedKg: number;
    waterProducedKg: number;
    fuelCellWasteHeatKWh: number;
  };
  stages: EnergyStage[];
}

export const DEFAULT_ENERGY_CHAIN_INPUT: EnergyChainInput = {
  inputEnergyKWh: 100,
  electrolyzerEfficiency: 0.70,
  conditioningEfficiency: 0.88,
  fuelCellEfficiency: 0.56,
  powerElectronicsEfficiency: 0.96,
  motorEfficiency: 0.92,
  drivetrainEfficiency: 0.95,
};

export function calculateEnergyChain(raw: EnergyChainInput): EnergyChainResult {
  const inputEnergyKWh = clampValue(raw.inputEnergyKWh, 1, 10000);
  const etaEl = clampValue(raw.electrolyzerEfficiency, 0.30, 0.92);
  const etaCond = clampValue(raw.conditioningEfficiency, 0.60, 0.99);
  const etaFc = clampValue(raw.fuelCellEfficiency, 0.30, 0.75);
  const etaPe = clampValue(raw.powerElectronicsEfficiency, 0.75, 0.99);
  const etaMotor = clampValue(raw.motorEfficiency, 0.70, 0.98);
  const etaDrive = clampValue(raw.drivetrainEfficiency, 0.75, 0.99);

  const eHydrogen = inputEnergyKWh * etaEl;
  const lossEl = inputEnergyKWh - eHydrogen;

  const eStored = eHydrogen * etaCond;
  const lossCond = eHydrogen - eStored;

  const eFuelCell = eStored * etaFc;
  const lossFc = eStored - eFuelCell;

  const ePowerElectronics = eFuelCell * etaPe;
  const lossPe = eFuelCell - ePowerElectronics;

  const eMotor = ePowerElectronics * etaMotor;
  const lossMotor = ePowerElectronics - eMotor;

  const eWheels = eMotor * etaDrive;
  const lossDrive = eMotor - eWheels;

  const totalLossesKWh = inputEnergyKWh - eWheels;

  const hydrogenProducedKg = eHydrogen / H2_LHV_KWH_PER_KG;
  const storedHydrogenKg = eStored / H2_LHV_KWH_PER_KG;

  const stages: EnergyStage[] = [
    {
      id: 'electrolyzer',
      label: 'Water Electrolysis (Off-Board)',
      shortLabel: 'Electrolyzer',
      energyInKWh: inputEnergyKWh,
      energyOutKWh: eHydrogen,
      lossKWh: lossEl,
      stageEfficiency: etaEl,
      cumulativeEfficiency: eHydrogen / inputEnergyKWh,
      colorHex: '#06B6D4',
    },
    {
      id: 'conditioning',
      label: 'Compression, Transport & 700-bar Storage',
      shortLabel: 'H₂ Conditioning',
      energyInKWh: eHydrogen,
      energyOutKWh: eStored,
      lossKWh: lossCond,
      stageEfficiency: etaCond,
      cumulativeEfficiency: eStored / inputEnergyKWh,
      colorHex: '#22D3EE',
    },
    {
      id: 'fuel_cell',
      label: 'PEM Fuel-Cell Stack (On-Board)',
      shortLabel: 'Fuel-Cell Stack',
      energyInKWh: eStored,
      energyOutKWh: eFuelCell,
      lossKWh: lossFc,
      stageEfficiency: etaFc,
      cumulativeEfficiency: eFuelCell / inputEnergyKWh,
      colorHex: '#10B981',
    },
    {
      id: 'power_electronics',
      label: 'DC/DC Converter & Traction Inverter',
      shortLabel: 'Power Electronics',
      energyInKWh: eFuelCell,
      energyOutKWh: ePowerElectronics,
      lossKWh: lossPe,
      stageEfficiency: etaPe,
      cumulativeEfficiency: ePowerElectronics / inputEnergyKWh,
      colorHex: '#FBBF24',
    },
    {
      id: 'motor',
      label: 'Electric Traction Motor',
      shortLabel: 'Electric Motor',
      energyInKWh: ePowerElectronics,
      energyOutKWh: eMotor,
      lossKWh: lossMotor,
      stageEfficiency: etaMotor,
      cumulativeEfficiency: eMotor / inputEnergyKWh,
      colorHex: '#F59E0B',
    },
    {
      id: 'drivetrain',
      label: 'Mechanical Gearbox & Driven Wheels',
      shortLabel: 'Drivetrain',
      energyInKWh: eMotor,
      energyOutKWh: eWheels,
      lossKWh: lossDrive,
      stageEfficiency: etaDrive,
      cumulativeEfficiency: eWheels / inputEnergyKWh,
      colorHex: '#FB923C',
    },
  ];

  return {
    inputEnergyKWh,
    hydrogenProducedKWh: eHydrogen,
    hydrogenProducedKg,
    storedHydrogenKWh: eStored,
    storedHydrogenKg,
    fuelCellElectricKWh: eFuelCell,
    powerElectronicsElectricKWh: ePowerElectronics,
    motorMechanicalKWh: eMotor,
    wheelMechanicalKWh: eWheels,
    totalLossesKWh,
    losses: {
      electrolyzerKWh: lossEl,
      conditioningKWh: lossCond,
      fuelCellKWh: lossFc,
      powerElectronicsKWh: lossPe,
      motorKWh: lossMotor,
      drivetrainKWh: lossDrive,
    },
    boundaries: {
      electricityToHydrogen: etaEl,
      hydrogenToElectricity: etaFc * etaPe,
      fuelCellStackOnly: etaFc,
      tankToWheels: etaFc * etaPe * etaMotor * etaDrive,
      electricityToWheels: eWheels / inputEnergyKWh,
    },
    onBoardByproducts: {
      oxygenConsumedKg: storedHydrogenKg * STOICH_OXYGEN_KG_PER_KG_H2,
      waterProducedKg: storedHydrogenKg * STOICH_WATER_KG_PER_KG_H2,
      fuelCellWasteHeatKWh: lossFc,
    },
    stages,
  };
}
