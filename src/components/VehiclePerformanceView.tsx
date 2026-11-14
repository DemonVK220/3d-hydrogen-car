import React, { useMemo } from 'react';
import {
  VehicleDynamicsInput,
  VehicleDynamicsResult,
  generatePowerSpeedCurve,
  generateRangeCapacityCurve,
} from '../physics/vehicleDynamics';
import { PowerSpeedChart, RangeCapacityChart } from './Charts';

interface VehiclePerformanceViewProps {
  dynamicsInput: VehicleDynamicsInput;
  dynamicsResult: VehicleDynamicsResult;
  onChangeDynamics: (patch: Partial<VehicleDynamicsInput>) => void;
}

export const VehiclePerformanceView: React.FC<VehiclePerformanceViewProps> = ({
  dynamicsInput,
  dynamicsResult,
  onChangeDynamics,
}) => {
  const powerCurve = useMemo(() => generatePowerSpeedCurve(dynamicsInput), [dynamicsInput]);
  const rangeCurve = useMemo(() => generateRangeCapacityCurve(dynamicsInput), [dynamicsInput]);

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-6 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-100">
            Vehicle Dynamics, Tractive Power &amp; Range Simulator
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-3xl">
            Steady-state longitudinal dynamics using SI units: aerodynamic drag{' '}
            <span className="font-mono text-slate-300">½ρC_dAv²</span>, rolling resistance{' '}
            <span className="font-mono text-slate-300">C_rrmg cos θ</span>, grade force{' '}
            <span className="font-mono text-slate-300">mg sin θ</span>, and inertial acceleration{' '}
            <span className="font-mono text-slate-300">ma</span>. Power (kW) is kept strictly distinct from energy (kWh).
          </p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[11px] text-slate-400">Estimated Remaining Range</div>
          <div className="text-2xl font-bold text-emerald-300">
            {dynamicsResult.estimatedRangeKm.toFixed(0)} <span className="text-sm text-slate-400">km</span>
          </div>
        </div>
      </div>

      {/* Live Telemetry Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">Total Tractive Force</div>
          <div className="font-mono text-lg font-semibold text-slate-100 mt-1">
            {dynamicsResult.forcesN.totalTractive.toFixed(0)} <span className="text-xs text-slate-400">N</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">Wheel Power Demand</div>
          <div className="font-mono text-lg font-semibold text-amber-300 mt-1">
            {dynamicsResult.wheelPowerKW.toFixed(2)} <span className="text-xs text-slate-400">kW</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">Fuel-Cell Electrical</div>
          <div className="font-mono text-lg font-semibold text-emerald-300 mt-1">
            {dynamicsResult.fuelCellElectricalDemandKW.toFixed(2)} <span className="text-xs text-slate-400">kW</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">H₂ Chemical Power</div>
          <div className="font-mono text-lg font-semibold text-cyan-300 mt-1">
            {dynamicsResult.hydrogenChemicalPowerKW.toFixed(2)} <span className="text-xs text-slate-400">kW</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">H₂ Consumption</div>
          <div className="font-mono text-lg font-semibold text-cyan-200 mt-1">
            {dynamicsResult.h2ConsumptionKgPer100Km.toFixed(2)} <span className="text-xs text-slate-400">kg/100km</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B121F] p-3.5">
          <div className="text-[11px] text-slate-400">Tank Energy Use</div>
          <div className="font-mono text-lg font-semibold text-slate-100 mt-1">
            {dynamicsResult.tankEnergyKWhPer100Km.toFixed(1)} <span className="text-xs text-slate-400">kWh/100km</span>
          </div>
        </div>
      </div>

      {/* Parameter Sliders + Force Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Vehicle &amp; Road Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                { key: 'speedKmh', label: 'Vehicle Speed', unit: 'km/h', min: 0, max: 180, step: 5, dec: 0 },
                { key: 'vehicleMassKg', label: 'Vehicle Mass', unit: 'kg', min: 1000, max: 3500, step: 50, dec: 0 },
                { key: 'frontalAreaM2', label: 'Frontal Area (A)', unit: 'm²', min: 1.6, max: 4.5, step: 0.05, dec: 2 },
                { key: 'dragCoefficient', label: 'Drag Coeff. (Cd)', unit: '', min: 0.20, max: 0.60, step: 0.01, dec: 2 },
                { key: 'rollingResistanceCoeff', label: 'Rolling Coeff. (Crr)', unit: '', min: 0.005, max: 0.025, step: 0.0005, dec: 4 },
                { key: 'roadGradientPercent', label: 'Road Gradient', unit: '%', min: -12, max: 12, step: 0.5, dec: 1 },
                { key: 'accelerationMs2', label: 'Acceleration (a)', unit: 'm/s²', min: -2.5, max: 2.5, step: 0.1, dec: 1 },
                { key: 'fuelCellMaxPowerKW', label: 'Fuel-Cell Rating', unit: 'kW', min: 50, max: 220, step: 5, dec: 0 },
                { key: 'tankCapacityKg', label: 'H₂ Tank Capacity', unit: 'kg', min: 2, max: 12, step: 0.2, dec: 1 },
                {
                  key: 'availableHydrogenKg',
                  label: 'Available H₂',
                  unit: 'kg',
                  min: 0,
                  max: dynamicsInput.tankCapacityKg,
                  step: 0.1,
                  dec: 1,
                },
              ] as const
            ).map((ctrl) => (
              <div key={ctrl.key}>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={`dyn-${ctrl.key}`} className="text-slate-300">
                    {ctrl.label}
                  </label>
                  <span className="font-mono text-cyan-300">
                    {dynamicsInput[ctrl.key].toFixed(ctrl.dec)} {ctrl.unit}
                  </span>
                </div>
                <input
                  id={`dyn-${ctrl.key}`}
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={dynamicsInput[ctrl.key]}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (ctrl.key === 'tankCapacityKg' && dynamicsInput.availableHydrogenKg > val) {
                      onChangeDynamics({ tankCapacityKg: val, availableHydrogenKg: val });
                    } else {
                      onChangeDynamics({ [ctrl.key]: val });
                    }
                  }}
                  className="eng-slider w-full"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Force Breakdown & Transient Buffer Info */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Tractive Force &amp; Power Balance
          </h2>

          <div className="space-y-3 text-xs font-mono">
            {[
              { label: 'Aerodynamic Drag (F_drag)', value: dynamicsResult.forcesN.aerodynamicDrag, color: 'bg-cyan-500' },
              { label: 'Rolling Resistance (F_roll)', value: dynamicsResult.forcesN.rollingResistance, color: 'bg-emerald-500' },
              { label: 'Grade Resistance (F_grade)', value: dynamicsResult.forcesN.gradeResistance, color: 'bg-amber-500' },
              { label: 'Inertial Accel (F_accel)', value: dynamicsResult.forcesN.acceleration, color: 'bg-violet-500' },
            ].map((item) => {
              const mag = Math.min(100, (Math.abs(item.value) / 5000) * 100);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300 font-sans">{item.label}</span>
                    <span className="text-slate-100">{item.value.toFixed(1)} N</span>
                  </div>
                  <div className="h-2 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${Math.max(2, mag)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Buffer Battery Assist:</span>
              <span className="text-violet-300">{dynamicsResult.batteryAssistKW.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Regenerative Capture (Capped):</span>
              <span className="text-emerald-300">{dynamicsResult.regenRecoveredKW.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Stack Waste Heat Rate:</span>
              <span className="text-rose-300">{dynamicsResult.fuelCellHeatLossKW.toFixed(2)} kW</span>
            </div>
            {dynamicsResult.isPowerLimited && (
              <p className="text-amber-300 pt-1">
                Notice: Demand exceeds fuel-cell + buffer battery continuous assist limit.
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Model boundary note: Negative tractive power during braking/downhill captures only up to{' '}
            {(dynamicsInput.regenCaptureFraction * 100).toFixed(0)}% of wheel energy into the buffer battery
            (capped at {dynamicsInput.maxRegenPowerKW} kW). Regenerative braking never generates hydrogen.
            Instantaneous range assumes steady continuation of the current operating point.
          </p>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5">
          <h3 className="font-display text-sm font-semibold text-slate-200 mb-2">
            Cruise Power Demand vs. Vehicle Speed (0% Grade)
          </h3>
          <PowerSpeedChart data={powerCurve} currentSpeedKmh={dynamicsInput.speedKmh} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5">
          <h3 className="font-display text-sm font-semibold text-slate-200 mb-2">
            Estimated Range vs. Hydrogen Tank Capacity (at {dynamicsInput.speedKmh.toFixed(0)} km/h)
          </h3>
          <RangeCapacityChart data={rangeCurve} currentCapacityKg={dynamicsInput.availableHydrogenKg} />
        </div>
      </div>
    </div>
  );
};
