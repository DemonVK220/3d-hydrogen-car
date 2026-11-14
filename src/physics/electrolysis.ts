export const H2_LHV_KWH_PER_KG = 33.33;
export const H2_HHV_KWH_PER_KG = 39.41;
// Exact stoichiometric mass ratios from 2 H2O -> 2 H2 + O2
// Molar masses: H2 = 2.016 g/mol, O2 = 31.998 g/mol, H2O = 18.015 g/mol
export const STOICH_WATER_KG_PER_KG_H2 = (2 * 18.015) / (2 * 2.016); // ~8.936 kg H2O / kg H2
export const STOICH_OXYGEN_KG_PER_KG_H2 = 31.998 / (2 * 2.016); // ~7.936 kg O2 / kg H2
export const ACTUAL_SYSTEM_WATER_FACTOR = 1.35; // Typical deionized feedwater + cooling makeup multiplier

export type ElectricitySourceId = 'renewable_wind_solar' | 'hydro_nuclear' | 'grid_mix';

export interface ElectricitySourceInfo {
  id: ElectricitySourceId;
  label: string;
  description: string;
  illustrativeCo2KgPerKWh: number;
}

export const ELECTRICITY_SOURCES: Record<ElectricitySourceId, ElectricitySourceInfo> = {
  renewable_wind_solar: {
    id: 'renewable_wind_solar',
    label: 'Wind & Solar (Green H₂)',
    description: 'Low-carbon renewable electricity; well-suited to absorbing surplus generation.',
    illustrativeCo2KgPerKWh: 0.03,
  },
  hydro_nuclear: {
    id: 'hydro_nuclear',
    label: 'Hydro & Nuclear (Pink/Green)',
    description: 'High-capacity-factor clean baseload electricity for steady electrolyzer operation.',
    illustrativeCo2KgPerKWh: 0.02,
  },
  grid_mix: {
    id: 'grid_mix',
    label: 'Average Utility Grid Mix',
    description: 'Grid-supplied electricity; emissions depend strongly on regional fossil generation share.',
    illustrativeCo2KgPerKWh: 0.38,
  },
};

export interface ElectrolysisInput {
  inputPowerKW: number;
  durationHours: number;
  electrolyzerEfficiency: number; // fraction [0.35, 0.90], LHV basis
  electricitySource: ElectricitySourceId;
}

export interface ElectrolysisResult {
  inputEnergyKWh: number;
  hydrogenEnergyKWh: number;
  energyLossKWh: number;
  outputPowerKW: number;
  hydrogenMassKg: number;
  theoreticalWaterKg: number;
  actualSystemWaterKg: number;
  oxygenProducedKg: number;
  specificEnergyKWhPerKgH2: number;
  estimatedCo2Kg: number;
  co2PerKgH2Kg: number;
}

export function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function calculateElectrolysis(rawInput: ElectrolysisInput): ElectrolysisResult {
  const inputPowerKW = clampValue(rawInput.inputPowerKW, 1, 5000);
  const durationHours = clampValue(rawInput.durationHours, 0.1, 240);
  const efficiency = clampValue(rawInput.electrolyzerEfficiency, 0.3, 0.92);

  const inputEnergyKWh = inputPowerKW * durationHours;
  const hydrogenEnergyKWh = inputEnergyKWh * efficiency;
  const energyLossKWh = inputEnergyKWh - hydrogenEnergyKWh;
  const outputPowerKW = inputPowerKW * efficiency;

  const hydrogenMassKg = hydrogenEnergyKWh / H2_LHV_KWH_PER_KG;
  const theoreticalWaterKg = hydrogenMassKg * STOICH_WATER_KG_PER_KG_H2;
  const actualSystemWaterKg = theoreticalWaterKg * ACTUAL_SYSTEM_WATER_FACTOR;
  const oxygenProducedKg = hydrogenMassKg * STOICH_OXYGEN_KG_PER_KG_H2;
  const specificEnergyKWhPerKgH2 = H2_LHV_KWH_PER_KG / efficiency;

  const source = ELECTRICITY_SOURCES[rawInput.electricitySource] ?? ELECTRICITY_SOURCES.renewable_wind_solar;
  const estimatedCo2Kg = inputEnergyKWh * source.illustrativeCo2KgPerKWh;
  const co2PerKgH2Kg = hydrogenMassKg > 0 ? estimatedCo2Kg / hydrogenMassKg : 0;

  return {
    inputEnergyKWh,
    hydrogenEnergyKWh,
    energyLossKWh,
    outputPowerKW,
    hydrogenMassKg,
    theoreticalWaterKg,
    actualSystemWaterKg,
    oxygenProducedKg,
    specificEnergyKWhPerKgH2,
    estimatedCo2Kg,
    co2PerKgH2Kg,
  };
}
