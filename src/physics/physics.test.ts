import test from 'node:test';
import assert from 'node:assert/strict';
import { H2_LHV_KWH_PER_KG, calculateElectrolysis } from './electrolysis';
import { DEFAULT_ENERGY_CHAIN_INPUT, calculateEnergyChain } from './energyChain';
import { DEFAULT_VEHICLE_DYNAMICS_INPUT, calculateVehicleDynamics } from './vehicleDynamics';
import { compareFcevVsBev } from './comparison';
import { EXPERIMENTS, formatTrialsCsv, runExperimentTrial } from './experiments';

test('electrolysis obeys LHV mass & stoichiometric conservation', () => {
  const res = calculateElectrolysis({
    inputPowerKW: 50,
    durationHours: 2,
    electrolyzerEfficiency: 0.70,
    electricitySource: 'renewable_wind_solar',
  });

  assert.equal(res.inputEnergyKWh, 100);
  assert.ok(Math.abs(res.hydrogenEnergyKWh - 70) < 1e-6);
  assert.ok(Math.abs(res.energyLossKWh - 30) < 1e-6);
  assert.ok(Math.abs(res.hydrogenMassKg - 70 / H2_LHV_KWH_PER_KG) < 1e-6);
  // Water ~ 9x H2 mass, O2 ~ 8x H2 mass
  assert.ok(res.theoreticalWaterKg > res.hydrogenMassKg * 8.9 && res.theoreticalWaterKg < res.hydrogenMassKg * 9.0);
  assert.ok(res.oxygenProducedKg > res.hydrogenMassKg * 7.9 && res.oxygenProducedKg < res.hydrogenMassKg * 8.0);
  // Conservation: H2 + O2 mass equals theoretical water split
  assert.ok(Math.abs(res.hydrogenMassKg + res.oxygenProducedKg - res.theoreticalWaterKg) < 0.02);
});

test('energy chain conserves total energy without double-counting losses', () => {
  const res = calculateEnergyChain(DEFAULT_ENERGY_CHAIN_INPUT);

  const summedLosses =
    res.losses.electrolyzerKWh +
    res.losses.conditioningKWh +
    res.losses.fuelCellKWh +
    res.losses.powerElectronicsKWh +
    res.losses.motorKWh +
    res.losses.drivetrainKWh;

  assert.ok(Math.abs(summedLosses - res.totalLossesKWh) < 1e-9);
  assert.ok(Math.abs(res.wheelMechanicalKWh + res.totalLossesKWh - res.inputEnergyKWh) < 1e-9);

  // Overall efficiency equals product of stage efficiencies
  const expectedOverall =
    DEFAULT_ENERGY_CHAIN_INPUT.electrolyzerEfficiency *
    DEFAULT_ENERGY_CHAIN_INPUT.conditioningEfficiency *
    DEFAULT_ENERGY_CHAIN_INPUT.fuelCellEfficiency *
    DEFAULT_ENERGY_CHAIN_INPUT.powerElectronicsEfficiency *
    DEFAULT_ENERGY_CHAIN_INPUT.motorEfficiency *
    DEFAULT_ENERGY_CHAIN_INPUT.drivetrainEfficiency;

  assert.ok(Math.abs(res.boundaries.electricityToWheels - expectedOverall) < 1e-9);
  assert.ok(res.boundaries.tankToWheels > res.boundaries.electricityToWheels);
});

test('vehicle dynamics enforces drag v^2 scaling, zero negative H2, and capped regen', () => {
  const cruise60 = calculateVehicleDynamics({
    ...DEFAULT_VEHICLE_DYNAMICS_INPUT,
    speedKmh: 60,
    roadGradientPercent: 0,
    accelerationMs2: 0,
  });
  const cruise120 = calculateVehicleDynamics({
    ...DEFAULT_VEHICLE_DYNAMICS_INPUT,
    speedKmh: 120,
    roadGradientPercent: 0,
    accelerationMs2: 0,
  });

  // Doubling speed quadruples aerodynamic drag force
  assert.ok(Math.abs(cruise120.forcesN.aerodynamicDrag / cruise60.forcesN.aerodynamicDrag - 4) < 1e-6);

  // Downhill braking must never produce negative hydrogen consumption or >100% regen
  const downhill = calculateVehicleDynamics({
    ...DEFAULT_VEHICLE_DYNAMICS_INPUT,
    speedKmh: 80,
    roadGradientPercent: -10,
    accelerationMs2: -1.5,
  });
  assert.ok(downhill.wheelPowerKW < 0);
  assert.equal(downhill.hydrogenChemicalPowerKW, 0);
  assert.equal(downhill.h2ConsumptionKgPer100Km, 0);
  assert.ok(downhill.regenRecoveredKW > 0);
  assert.ok(downhill.regenRecoveredKW <= DEFAULT_VEHICLE_DYNAMICS_INPUT.maxRegenPowerKW);
});

test('BEV vs FCEV comparison uses identical input energy boundary', () => {
  const cmp = compareFcevVsBev({ ...DEFAULT_ENERGY_CHAIN_INPUT, inputEnergyKWh: 100 });
  assert.equal(cmp.inputEnergyKWh, 100);
  assert.ok(cmp.bev.overallEfficiencyPct > cmp.fcev.overallEfficiencyPct);
  assert.ok(Math.abs(cmp.bev.wheelEnergyKWh + cmp.bev.totalLossesKWh - 100) < 1e-9);
  assert.ok(Math.abs(cmp.fcev.wheelEnergyKWh + cmp.fcev.totalLossesKWh - 100) < 1e-9);
});

test('virtual physics lab trial runner and CSV export match', () => {
  const t1 = runExperimentTrial('exp_d', 50, 1);
  const t2 = runExperimentTrial('exp_d', 100, 2);
  assert.ok(t2.dependentValue > t1.dependentValue);

  const csv = formatTrialsCsv(EXPERIMENTS.exp_d, [t1, t2]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes(t1.dependentValue.toFixed(3)));
});
