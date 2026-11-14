import React, { useMemo, useState } from 'react';
import {
  ELECTRICITY_SOURCES,
  ElectricitySourceId,
  ElectrolysisInput,
  H2_HHV_KWH_PER_KG,
  H2_LHV_KWH_PER_KG,
  calculateElectrolysis,
} from '../physics/electrolysis';
import { EnergyChainInput, EnergyChainResult } from '../physics/energyChain';
import { EnergySankeyChart, LossesBarChart } from './Charts';

interface EnergyElectrolysisViewProps {
  chainInput: EnergyChainInput;
  chainResult: EnergyChainResult;
  onChangeChainInput: (patch: Partial<EnergyChainInput>) => void;
}

export const EnergyElectrolysisView: React.FC<EnergyElectrolysisViewProps> = ({
  chainInput,
  chainResult,
  onChangeChainInput,
}) => {
  const [elecInput, setElecInput] = useState<ElectrolysisInput>({
    inputPowerKW: 50,
    durationHours: 2.0,
    electrolyzerEfficiency: chainInput.electrolyzerEfficiency,
    electricitySource: 'renewable_wind_solar',
  });

  const elecResult = useMemo(
    () =>
      calculateElectrolysis({
        ...elecInput,
        electrolyzerEfficiency: chainInput.electrolyzerEfficiency,
      }),
    [elecInput, chainInput.electrolyzerEfficiency],
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-6 space-y-8">
      {/* Section Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="font-display text-2xl font-semibold text-slate-100">
          Electrolysis &amp; Complete Energy Conversion Chain
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">
          Hydrogen is an energy carrier, not a primary fuel. All calculations use the{' '}
          <span className="text-cyan-300 font-mono">Lower Heating Value (LHV = {H2_LHV_KWH_PER_KG} kWh/kg)</span>{' '}
          consistently across production and consumption (HHV = {H2_HHV_KWH_PER_KG} kWh/kg for reference).
        </p>
      </div>

      {/* Module 1: Off-Board Water Electrolysis */}
      <section className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 lg:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cyan-300">
              01. Off-Board Water Electrolysis Simulator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Electrolyzer sits at the hydrogen production plant (never inside the vehicle). Requires external electricity.
            </p>
          </div>
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3.5 py-2 font-mono text-sm text-cyan-200">
            2H₂O(l) + Electrical Energy → 2H₂(g) + O₂(g)
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="elec-power" className="text-slate-300">Electrical Input Power</label>
                <span className="font-mono text-cyan-300">{elecInput.inputPowerKW.toFixed(0)} kW</span>
              </div>
              <input
                id="elec-power"
                type="range"
                min={5}
                max={500}
                step={5}
                value={elecInput.inputPowerKW}
                onChange={(e) =>
                  setElecInput((prev) => ({ ...prev, inputPowerKW: parseFloat(e.target.value) }))
                }
                className="eng-slider w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="elec-duration" className="text-slate-300">Operating Duration</label>
                <span className="font-mono text-cyan-300">{elecInput.durationHours.toFixed(1)} h</span>
              </div>
              <input
                id="elec-duration"
                type="range"
                min={0.5}
                max={24}
                step={0.5}
                value={elecInput.durationHours}
                onChange={(e) =>
                  setElecInput((prev) => ({ ...prev, durationHours: parseFloat(e.target.value) }))
                }
                className="eng-slider w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="elec-eff" className="text-slate-300">Electrolyzer Efficiency (η_el, LHV basis)</label>
                <span className="font-mono text-cyan-300">
                  {(chainInput.electrolyzerEfficiency * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="elec-eff"
                type="range"
                min={40}
                max={88}
                step={1}
                value={Math.round(chainInput.electrolyzerEfficiency * 100)}
                onChange={(e) =>
                  onChangeChainInput({ electrolyzerEfficiency: parseFloat(e.target.value) / 100 })
                }
                className="eng-slider w-full"
              />
            </div>

            <div>
              <label htmlFor="elec-source" className="block text-xs text-slate-300 mb-1.5">
                External Electricity Source
              </label>
              <select
                id="elec-source"
                value={elecInput.electricitySource}
                onChange={(e) =>
                  setElecInput((prev) => ({
                    ...prev,
                    electricitySource: e.target.value as ElectricitySourceId,
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {Object.values(ELECTRICITY_SOURCES).map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {ELECTRICITY_SOURCES[elecInput.electricitySource].description}
              </p>
            </div>
          </div>

          {/* Calculated Outputs */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">External Electrical Input</div>
              <div className="font-mono text-xl font-semibold text-slate-100 mt-1">
                {elecResult.inputEnergyKWh.toFixed(1)} <span className="text-xs text-slate-400">kWh</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-1">
                {elecInput.inputPowerKW.toFixed(0)} kW × {elecInput.durationHours.toFixed(1)} h
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">Hydrogen Produced (LHV)</div>
              <div className="font-mono text-xl font-semibold text-cyan-300 mt-1">
                {elecResult.hydrogenMassKg.toFixed(2)} <span className="text-xs text-slate-400">kg H₂</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-1">
                {elecResult.hydrogenEnergyKWh.toFixed(1)} kWh chemical
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">Electrolyzer Heat Loss</div>
              <div className="font-mono text-xl font-semibold text-rose-300 mt-1">
                {elecResult.energyLossKWh.toFixed(1)} <span className="text-xs text-slate-400">kWh</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-1">
                {elecResult.specificEnergyKWhPerKgH2.toFixed(1)} kWh/kg H₂
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">Theoretical Water Split</div>
              <div className="font-mono text-lg font-semibold text-sky-300 mt-1">
                {elecResult.theoreticalWaterKg.toFixed(1)} <span className="text-xs text-slate-400">kg H₂O</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Stoichiometric (~8.94× m_H₂)
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">Actual Plant Water</div>
              <div className="font-mono text-lg font-semibold text-sky-200 mt-1">
                {elecResult.actualSystemWaterKg.toFixed(1)} <span className="text-xs text-slate-400">kg H₂O</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Includes deionization &amp; cooling
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3.5">
              <div className="text-[11px] text-slate-400">Oxygen Co-Product</div>
              <div className="font-mono text-lg font-semibold text-emerald-300 mt-1">
                {elecResult.oxygenProducedKg.toFixed(1)} <span className="text-xs text-slate-400">kg O₂</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Est. {elecResult.co2PerKgH2Kg.toFixed(1)} kg CO₂/kg H₂
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 border-t border-slate-800 pt-3">
          Why losses occur: Real electrolyzers require extra voltage above the 1.23 V reversible cell potential to
          overcome electrode activation barriers, membrane ionic resistance, and gas-bubble transport losses, converting{' '}
          {(100 - chainInput.electrolyzerEfficiency * 100).toFixed(0)}% of input electricity into low-grade heat.
        </p>
      </section>

      {/* Module 2: Complete Energy Conversion Calculator */}
      <section className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 lg:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-emerald-300">
              02. Complete Energy Conversion Chain &amp; Fuel-Cell Calculator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              On-board reaction: <span className="font-mono text-emerald-200">2H₂ + O₂ → 2H₂O + DC electricity + heat</span>.
              Auxiliary HVAC/compressor loads are omitted from this simplified stage-efficiency accounting model.
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-[11px] text-slate-400">Overall Electricity → Wheels</div>
            <div className="text-2xl font-bold text-amber-300">
              {(chainResult.boundaries.electricityToWheels * 100).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Interactive Parameter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="chain-ein" className="text-slate-300">E_input (Electricity)</label>
              <span className="font-mono text-slate-100">{chainInput.inputEnergyKWh.toFixed(0)} kWh</span>
            </div>
            <input
              id="chain-ein"
              type="range"
              min={10}
              max={500}
              step={10}
              value={chainInput.inputEnergyKWh}
              onChange={(e) => onChangeChainInput({ inputEnergyKWh: parseFloat(e.target.value) })}
              className="eng-slider w-full"
            />
          </div>

          {(
            [
              { key: 'electrolyzerEfficiency', label: 'η_el (Electrolyzer)', min: 40, max: 88 },
              { key: 'conditioningEfficiency', label: 'η_cond (700-bar Delivery)', min: 70, max: 96 },
              { key: 'fuelCellEfficiency', label: 'η_fc (Fuel-Cell Stack)', min: 35, max: 70 },
              { key: 'powerElectronicsEfficiency', label: 'η_pe (DC/DC + Inverter)', min: 85, max: 99 },
              { key: 'motorEfficiency', label: 'η_motor (Traction Motor)', min: 78, max: 97 },
              { key: 'drivetrainEfficiency', label: 'η_drive (Gearbox & Axle)', min: 85, max: 99 },
            ] as const
          ).map((ctrl) => (
            <div key={ctrl.key}>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor={`chain-${ctrl.key}`} className="text-slate-300">
                  {ctrl.label}
                </label>
                <span className="font-mono text-cyan-300">
                  {(chainInput[ctrl.key] * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id={`chain-${ctrl.key}`}
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={1}
                value={Math.round(chainInput[ctrl.key] * 100)}
                onChange={(e) =>
                  onChangeChainInput({ [ctrl.key]: parseFloat(e.target.value) / 100 })
                }
                className="eng-slider w-full"
              />
            </div>
          ))}
        </div>

        {/* Distinct System Boundaries */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3">
            <div className="text-[11px] text-slate-400">Boundary: Electricity → H₂</div>
            <div className="font-mono text-lg font-semibold text-cyan-300 mt-1">
              {(chainResult.boundaries.electricityToHydrogen * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              {chainResult.hydrogenProducedKg.toFixed(2)} kg H₂ produced
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3">
            <div className="text-[11px] text-slate-400">Boundary: Stored H₂ → Electric Bus</div>
            <div className="font-mono text-lg font-semibold text-emerald-300 mt-1">
              {(chainResult.boundaries.hydrogenToElectricity * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              {chainResult.powerElectronicsElectricKWh.toFixed(1)} kWh AC out
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3">
            <div className="text-[11px] text-slate-400">Boundary: Tank → Wheels</div>
            <div className="font-mono text-lg font-semibold text-amber-300 mt-1">
              {(chainResult.boundaries.tankToWheels * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              From {chainResult.storedHydrogenKg.toFixed(2)} kg stored H₂
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3">
            <div className="text-[11px] text-slate-400">Boundary: Electricity → Wheels</div>
            <div className="font-mono text-lg font-semibold text-slate-100 mt-1">
              {chainResult.wheelMechanicalKWh.toFixed(2)} <span className="text-xs text-slate-400">kWh</span>
            </div>
            <div className="font-mono text-[11px] text-rose-300">
              {chainResult.totalLossesKWh.toFixed(2)} kWh total losses
            </div>
          </div>
        </div>

        {/* Sankey + Stage Loss Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          <div className="lg:col-span-8 rounded-lg border border-slate-800 bg-[#070B12] p-4">
            <h3 className="text-sm font-medium text-slate-200 mb-2">
              Energy Flow Conversion Chain (kWh Retained vs. Stage Losses)
            </h3>
            <EnergySankeyChart chain={chainResult} />
          </div>

          <div className="lg:col-span-4 rounded-lg border border-slate-800 bg-[#070B12] p-4">
            <h3 className="text-sm font-medium text-slate-200 mb-3">
              Energy Losses by Component
            </h3>
            <LossesBarChart chain={chainResult} />
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
              <div className="flex justify-between">
                <span>On-Board O₂ Used:</span>
                <span className="text-sky-300">{chainResult.onBoardByproducts.oxygenConsumedKg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span>On-Board H₂O Exhaust:</span>
                <span className="text-blue-300">{chainResult.onBoardByproducts.waterProducedKg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span>Stack Waste Heat:</span>
                <span className="text-rose-300">{chainResult.onBoardByproducts.fuelCellWasteHeatKWh.toFixed(2)} kWh</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
