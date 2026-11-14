import { DEFAULT_ENERGY_CHAIN_INPUT, calculateEnergyChain } from './energyChain';
import { DEFAULT_VEHICLE_DYNAMICS_INPUT, calculateVehicleDynamics } from './vehicleDynamics';

export type ExperimentId = 'exp_a' | 'exp_b' | 'exp_c' | 'exp_d' | 'exp_e';

export interface ExperimentDefinition {
  id: ExperimentId;
  title: string;
  shortTitle: string;
  objective: string;
  hypothesis: string;
  independentVarLabel: string;
  independentVarUnit: string;
  dependentVarLabel: string;
  dependentVarUnit: string;
  secondaryVarLabel: string;
  secondaryVarUnit: string;
  controlledSummary: string;
  procedure: string[];
  interpretation: string;
  limitations: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ExperimentTrial {
  id: string;
  experimentId: ExperimentId;
  trialNumber: number;
  independentValue: number;
  dependentValue: number;
  secondaryValue: number;
  notes: string;
  timestampIso: string;
}

export const EXPERIMENTS: Record<ExperimentId, ExperimentDefinition> = {
  exp_a: {
    id: 'exp_a',
    title: 'Experiment A: Electrolyzer Efficiency vs. Overall Conversion',
    shortTitle: 'Electrolyzer Efficiency',
    objective:
      'Quantify how water electrolyzer efficiency (η_el) affects overall electricity-to-wheels efficiency and hydrogen yield for a fixed 100 kWh electrical input.',
    hypothesis:
      'Because overall efficiency is the product of all stage efficiencies, increasing η_el increases overall wheel energy linearly when downstream efficiencies remain constant.',
    independentVarLabel: 'Electrolyzer Efficiency (η_el)',
    independentVarUnit: '%',
    dependentVarLabel: 'Overall Electricity-to-Wheels Efficiency',
    dependentVarUnit: '%',
    secondaryVarLabel: 'Wheel Mechanical Energy (from 100 kWh)',
    secondaryVarUnit: 'kWh',
    controlledSummary:
      'E_input = 100 kWh, η_condition = 88%, η_fc = 56%, η_pe = 96%, η_motor = 92%, η_drive = 95%.',
    procedure: [
      'Hold input electricity constant at 100 kWh and fix downstream powertrain efficiencies at baseline values.',
      'Vary electrolyzer efficiency from 45% (legacy alkaline) to 85% (advanced high-temperature SOEC).',
      'Record overall electricity-to-wheels efficiency (%) and net mechanical wheel energy (kWh) for each trial.',
    ],
    interpretation:
      'The relationship is strictly linear because downstream stages operate at fixed fractional efficiencies. Even at 85% electrolysis efficiency, downstream fuel-cell losses limit electricity-to-wheels efficiency below ~38%.',
    limitations:
      'Assumes constant electrolyzer efficiency independent of current density and omits balance-of-plant compressor energy variation.',
    min: 45,
    max: 85,
    step: 5,
    defaultValue: 70,
  },
  exp_b: {
    id: 'exp_b',
    title: 'Experiment B: Fuel-Cell Efficiency vs. Electrical Output',
    shortTitle: 'Fuel-Cell Efficiency',
    objective:
      'Measure how PEM fuel-cell stack efficiency (η_fc) alters useful electrical bus output and waste heat rejection from 100 kWh of stored hydrogen (LHV basis).',
    hypothesis:
      'Higher fuel-cell efficiency increases useful electrical output proportionally while reducing rejected thermal energy by the exact same magnitude (energy conservation).',
    independentVarLabel: 'Fuel-Cell Stack Efficiency (η_fc)',
    independentVarUnit: '%',
    dependentVarLabel: 'Useful Electrical Energy Output',
    dependentVarUnit: 'kWh',
    secondaryVarLabel: 'Fuel-Cell Waste Heat Loss',
    secondaryVarUnit: 'kWh',
    controlledSummary:
      'Stored H₂ chemical energy = 100 kWh (3.00 kg H₂ LHV), η_pe = 96%, steady operating temperature assumption.',
    procedure: [
      'Set stored hydrogen energy to 100 kWh (LHV basis, 3.00 kg H₂).',
      'Sweep fuel-cell stack efficiency from 35% (high-load polarization region) to 68% (optimal partial-load region).',
      'Record useful electrical output after power electronics (kWh) and stack heat loss (kWh).',
    ],
    interpretation:
      'Real PEM fuel cells achieve peak efficiency (~58–62%) at moderate load (25–40% of rated power) and drop toward ~40–45% at peak power due to ohmic and mass-transport overpotentials.',
    limitations:
      'Uses a single lumped efficiency parameter instead of a full polarization (V–I) curve and assumes isothermal heat rejection.',
    min: 35,
    max: 68,
    step: 3,
    defaultValue: 56,
  },
  exp_c: {
    id: 'exp_c',
    title: 'Experiment C: Electric Motor Efficiency vs. Wheel Energy',
    shortTitle: 'Motor Efficiency',
    objective:
      'Evaluate the sensitivity of final wheel mechanical energy to traction motor efficiency (η_motor) for a fixed 100 kWh electricity-to-hydrogen baseline.',
    hypothesis:
      'Motor efficiency scales wheel mechanical output linearly, though its absolute kWh impact is bounded by the upstream chemical-to-electrical conversion stages.',
    independentVarLabel: 'Electric Motor Efficiency (η_motor)',
    independentVarUnit: '%',
    dependentVarLabel: 'Wheel Mechanical Energy',
    dependentVarUnit: 'kWh',
    secondaryVarLabel: 'Motor Heat Loss',
    secondaryVarUnit: 'kWh',
    controlledSummary:
      'E_input = 100 kWh, η_el = 70%, η_condition = 88%, η_fc = 56%, η_pe = 96%, η_drive = 95%.',
    procedure: [
      'Keep upstream hydrogen production and fuel-cell efficiency fixed at baseline values.',
      'Adjust electric traction motor efficiency from 75% to 97%.',
      'Compare the change in wheel mechanical energy (kWh) against upstream stage sensitivities.',
    ],
    interpretation:
      'Because modern permanent-magnet synchronous motors already operate around 90–96% across typical drive cycles, improving motor efficiency yields smaller absolute gains than improving electrolysis or fuel-cell efficiency.',
    limitations:
      'Represents a single operating point rather than integrating over a full motor torque-speed efficiency map.',
    min: 75,
    max: 97,
    step: 2,
    defaultValue: 92,
  },
  exp_d: {
    id: 'exp_d',
    title: 'Experiment D: Vehicle Speed vs. Tractive Power Demand',
    shortTitle: 'Speed vs. Power',
    objective:
      'Verify the nonlinear aerodynamic drag relationship between steady-state cruising speed and required wheel power demand.',
    hypothesis:
      'Because aerodynamic drag force scales with v² and power equals F × v, aerodynamic power demand scales with v³, causing total power demand to rise steeply at highway speeds.',
    independentVarLabel: 'Vehicle Cruising Speed (v)',
    independentVarUnit: 'km/h',
    dependentVarLabel: 'Wheel Power Demand',
    dependentVarUnit: 'kW',
    secondaryVarLabel: 'Hydrogen Consumption Rate',
    secondaryVarUnit: 'kg/100 km',
    controlledSummary:
      'Mass = 1850 kg, Cd = 0.27, A = 2.38 m², Crr = 0.0095, flat road (0% grade), zero acceleration.',
    procedure: [
      'Select flat road (0% gradient) and steady speed (acceleration = 0 m/s²).',
      'Test speeds from 20 km/h (urban) to 160 km/h (high-speed Autobahn).',
      'Observe how wheel power (kW) and specific hydrogen consumption (kg/100 km) respond non-linearly.',
    ],
    interpretation:
      'At low speeds, rolling resistance dominates; above ~75 km/h, cubic aerodynamic drag dominates. Doubling speed from 60 to 120 km/h multiplies aerodynamic power by 8×.',
    limitations:
      'Steady-state cruise model excludes wind gusts, HVAC auxiliary loads, and transient stop-and-go acceleration cycles.',
    min: 20,
    max: 160,
    step: 15,
    defaultValue: 90,
  },
  exp_e: {
    id: 'exp_e',
    title: 'Experiment E: Vehicle Mass vs. Energy Consumption',
    shortTitle: 'Mass vs. Consumption',
    objective:
      'Determine how vehicle mass influences hydrogen energy consumption during steady cruising versus climbing a 4% road gradient.',
    hypothesis:
      'On a gentle incline (4% grade), increasing vehicle mass substantially increases both rolling resistance and gravitational grade force, raising energy consumption linearly with mass.',
    independentVarLabel: 'Vehicle Mass (m)',
    independentVarUnit: 'kg',
    dependentVarLabel: 'Tank Energy Consumption (4% Grade, 80 km/h)',
    dependentVarUnit: 'kWh/100 km',
    secondaryVarLabel: 'Hydrogen Consumption',
    secondaryVarUnit: 'kg/100 km',
    controlledSummary:
      'Speed = 80 km/h, gradient = +4%, Cd = 0.27, A = 2.38 m², Crr = 0.0095, baseline powertrain efficiencies.',
    procedure: [
      'Hold speed at 80 km/h on a +4% continuous climb to make mass-dependent forces prominent.',
      'Vary vehicle mass from 1200 kg (compact hatchback) to 3200 kg (heavy SUV / light commercial van).',
      'Record chemical energy consumption (kWh/100 km) and hydrogen consumption (kg/100 km).',
    ],
    interpretation:
      'Both rolling resistance (Crr·m·g) and grade resistance (m·g·sin θ) scale linearly with mass. Lightweighting directly reduces hill-climbing and urban acceleration energy demand.',
    limitations:
      'Constant +4% gradient represents a sustained climb; on flat roads with regenerative braking, mass penalties are smaller than on uphill grades.',
    min: 1200,
    max: 3200,
    step: 250,
    defaultValue: 1850,
  },
};

export function runExperimentTrial(
  experimentId: ExperimentId,
  independentValue: number,
  trialNumber: number,
): ExperimentTrial {
  let dependentValue = 0;
  let secondaryValue = 0;

  if (experimentId === 'exp_a') {
    const res = calculateEnergyChain({
      ...DEFAULT_ENERGY_CHAIN_INPUT,
      inputEnergyKWh: 100,
      electrolyzerEfficiency: independentValue / 100,
    });
    dependentValue = res.boundaries.electricityToWheels * 100;
    secondaryValue = res.wheelMechanicalKWh;
  } else if (experimentId === 'exp_b') {
    // Boundary: 100 kWh stored H2 entering fuel cell -> electrical output after PE & stack waste heat
    const res = calculateEnergyChain({
      ...DEFAULT_ENERGY_CHAIN_INPUT,
      inputEnergyKWh: 100,
      electrolyzerEfficiency: 1, // Direct stored-H2 boundary achieved via helper below
      conditioningEfficiency: 1,
      fuelCellEfficiency: independentValue / 100,
    });
    // Use direct physical formula matching the controlled summary: 100 kWh stored H2
    const storedH2 = 100;
    const etaFc = independentValue / 100;
    const etaPe = DEFAULT_ENERGY_CHAIN_INPUT.powerElectronicsEfficiency;
    const fcElec = storedH2 * etaFc;
    dependentValue = fcElec * etaPe;
    secondaryValue = storedH2 - fcElec;
    void res;
  } else if (experimentId === 'exp_c') {
    const res = calculateEnergyChain({
      ...DEFAULT_ENERGY_CHAIN_INPUT,
      inputEnergyKWh: 100,
      motorEfficiency: independentValue / 100,
    });
    dependentValue = res.wheelMechanicalKWh;
    secondaryValue = res.losses.motorKWh;
  } else if (experimentId === 'exp_d') {
    const res = calculateVehicleDynamics({
      ...DEFAULT_VEHICLE_DYNAMICS_INPUT,
      speedKmh: independentValue,
      roadGradientPercent: 0,
      accelerationMs2: 0,
    });
    dependentValue = res.wheelPowerKW;
    secondaryValue = res.h2ConsumptionKgPer100Km;
  } else if (experimentId === 'exp_e') {
    const res = calculateVehicleDynamics({
      ...DEFAULT_VEHICLE_DYNAMICS_INPUT,
      vehicleMassKg: independentValue,
      speedKmh: 80,
      roadGradientPercent: 4,
      accelerationMs2: 0,
    });
    dependentValue = res.tankEnergyKWhPer100Km;
    secondaryValue = res.h2ConsumptionKgPer100Km;
  }

  return {
    id: `${experimentId}-${trialNumber}-${Date.now()}`,
    experimentId,
    trialNumber,
    independentValue,
    dependentValue,
    secondaryValue,
    notes: 'Computed simulation trial (steady-state analytical model)',
    timestampIso: new Date().toISOString(),
  };
}

export function formatTrialsCsv(experiment: ExperimentDefinition, trials: ExperimentTrial[]): string {
  const header = [
    'Trial',
    `${experiment.independentVarLabel} (${experiment.independentVarUnit})`,
    `${experiment.dependentVarLabel} (${experiment.dependentVarUnit})`,
    `${experiment.secondaryVarLabel} (${experiment.secondaryVarUnit})`,
    'Model Basis',
    'Timestamp (UTC)',
  ].join(',');

  const rows = trials.map((t) =>
    [
      t.trialNumber,
      t.independentValue.toFixed(2),
      t.dependentValue.toFixed(3),
      t.secondaryValue.toFixed(3),
      `"${t.notes}"`,
      t.timestampIso,
    ].join(','),
  );

  return [header, ...rows].join('\n');
}
