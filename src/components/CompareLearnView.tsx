import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BevAssumptions, DEFAULT_BEV_ASSUMPTIONS, compareFcevVsBev } from '../physics/comparison';
import { EnergyChainInput } from '../physics/energyChain';
import { PathwayComparisonChart } from './Charts';

interface CurriculumTopic {
  title: string;
  equation?: string;
  body: string;
}

const CURRICULUM_TOPICS: CurriculumTopic[] = [
  {
    title: '01. What is hydrogen?',
    body: 'Hydrogen (H₂) is the lightest chemical element (molar mass 2.016 g/mol). At standard temperature and pressure it is a colorless gas, and its molecular bonds store high chemical energy per unit mass (33.33 kWh/kg LHV — nearly 2.8× gasoline per kilogram), though its volumetric density is very low unless compressed or liquefied.',
  },
  {
    title: '02. Why is hydrogen an energy carrier rather than a primary energy source?',
    body: 'Unlike sunlight, wind, or fossil reserves, free molecular hydrogen does not exist in large accessible underground reservoirs on Earth. Hydrogen must be manufactured using an external energy input (such as electricity splitting water in an electrolyzer). Therefore, hydrogen acts like a chemical battery or energy carrier that moves and stores energy created elsewhere.',
  },
  {
    title: '03. How does water electrolysis work?',
    equation: '2H₂O(l) + electrical energy → 2H₂(g) + O₂(g)',
    body: 'An electrolyzer applies direct electrical voltage across two electrodes separated by an electrolyte membrane. Water molecules split into hydrogen gas at the cathode and oxygen gas at the anode. Thermodynamically, producing 1 kg of H₂ requires at least 33.33 kWh (LHV) / 39.41 kWh (HHV), and real systems need ~45–55 kWh/kg due to overpotentials and thermal losses.',
  },
  {
    title: '04. How is hydrogen stored in a vehicle?',
    body: 'Passenger FCEVs typically store gaseous hydrogen at 70 MPa (700 bar) inside carbon-fiber-wound Type-IV pressure vessels. Compressing H₂ requires mechanical work (~8–12% of the hydrogen energy content), and high-strength composite tanks keep the gas safely contained during refueling and driving.',
  },
  {
    title: '05. How does a PEM fuel cell generate electricity?',
    equation: '2H₂ + O₂ → 2H₂O + DC electricity + heat',
    body: 'Inside a Proton Exchange Membrane (PEM) fuel cell, hydrogen enters the anode and splits into protons (H⁺) and electrons (e⁻). Only protons pass through the polymer membrane to the cathode, forcing electrons through the vehicle external electrical circuit to do useful work. At the cathode, protons, electrons, and atmospheric oxygen combine into water vapor and waste heat.',
  },
  {
    title: '06. How does an electric traction motor produce motion?',
    body: 'Three-phase AC current from the inverter creates a rotating magnetic field in the stationary motor stator. This field pulls on the permanent-magnet rotor, converting electrical power (V × I) into mechanical shaft torque and angular velocity (τ × ω), which passes through a single-speed reduction gearbox to turn the wheels.',
  },
  {
    title: '07. Why does every energy conversion cause losses?',
    body: 'By the Second Law of Thermodynamics and practical irreversibilities (electrical resistance, electrochemical activation barriers, friction, and fluid drag), no real conversion process is 100% efficient. Each stage rejects a fraction of input energy as low-grade heat, and because stage efficiencies multiply, multi-step chains compound losses rapidly.',
  },
  {
    title: '08. How is overall system efficiency calculated?',
    equation: 'η_overall = η_el × η_cond × η_fc × η_pe × η_motor × η_drive',
    body: 'System boundaries matter: Tank-to-Wheels efficiency (~45–55%) measures only onboard conversion from stored H₂ to the wheels, whereas Electricity-to-Wheels efficiency (~25–35%) includes off-board electrolysis and 700-bar compression/delivery losses.',
  },
  {
    title: '09. What affects vehicle energy consumption?',
    equation: 'P_wheels = (½ρC_dAv² + C_rmg cosθ + mg sinθ + ma) · v',
    body: 'At low urban speeds, tire rolling resistance and acceleration mass dominate. At highway speeds, aerodynamic drag power rises with the cube of velocity (v³), while road climbs add gravitational grade power (mgv sin θ).',
  },
  {
    title: '10. How do fuel-cell vehicles compare with battery-electric vehicles?',
    body: 'BEVs skip electrolysis and fuel-cell conversion, delivering roughly 2–2.5× higher electricity-to-wheels efficiency (~70–75% vs ~25–35%). FCEVs trade that extra grid electricity for lighter onboard energy storage at long ranges and 3–5 minute high-pressure refueling—making FCEVs particularly relevant to study for heavy-duty trucking, buses, rail, shipping, and high-utilization fleets.',
  },
];

interface CompareLearnViewProps {
  chainInput: EnergyChainInput;
}

export const CompareLearnView: React.FC<CompareLearnViewProps> = ({ chainInput }) => {
  const [bevAssumptions, setBevAssumptions] = useState<BevAssumptions>(DEFAULT_BEV_ASSUMPTIONS);
  const [openTopicIdx, setOpenTopicIdx] = useState<number>(0);

  const comparison = useMemo(
    () => compareFcevVsBev(chainInput, bevAssumptions),
    [chainInput, bevAssumptions],
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-6 space-y-8">
      {/* Section 1: FCEV vs BEV Equivalent-Boundary Comparison */}
      <section className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 lg:p-6 space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-100">
              FCEV vs. BEV Pathway Comparison
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-3xl">
              Both pathways start from an identical boundary:{' '}
              <span className="font-mono text-slate-200">{comparison.inputEnergyKWh.toFixed(0)} kWh</span> of
              external grid/renewable electricity before charging or electrolysis.
            </p>
          </div>
          <div className="font-mono text-right">
            <div className="text-[11px] text-slate-400">Relative Electricity-to-Wheels Ratio</div>
            <div className="text-xl font-bold text-emerald-300">
              BEV delivers {comparison.relativeRatioBevToFcev.toFixed(2)}× wheel energy
            </div>
          </div>
        </div>

        <PathwayComparisonChart comparison={comparison} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-emerald-300">Adjustable BEV Assumptions</h2>
            {(
              [
                { key: 'gridAndChargerEfficiency', label: 'Grid + Charger Efficiency', min: 80, max: 97 },
                { key: 'batteryRoundTripEfficiency', label: 'Li-ion Battery Round-Trip', min: 80, max: 96 },
              ] as const
            ).map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={`bev-${c.key}`} className="text-slate-300">{c.label}</label>
                  <span className="font-mono text-emerald-300">{(bevAssumptions[c.key] * 100).toFixed(0)}%</span>
                </div>
                <input
                  id={`bev-${c.key}`}
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={1}
                  value={Math.round(bevAssumptions[c.key] * 100)}
                  onChange={(e) =>
                    setBevAssumptions((b) => ({ ...b, [c.key]: parseFloat(e.target.value) / 100 }))
                  }
                  className="eng-slider w-full"
                />
              </div>
            ))}
            <p className="text-[11px] text-slate-400">
              BEV inverter ({(bevAssumptions.powerElectronicsEfficiency * 100).toFixed(0)}%), motor (
              {(bevAssumptions.motorEfficiency * 100).toFixed(0)}%), and drivetrain (
              {(bevAssumptions.drivetrainEfficiency * 100).toFixed(0)}%) share comparable electric-drive efficiency.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B12] p-4 text-xs text-slate-300 space-y-2 leading-relaxed">
            <h2 className="text-sm font-semibold text-slate-100">Balanced Engineering Tradeoffs</h2>
            <p>
              <strong>Where BEVs excel:</strong> Passenger vehicles, urban delivery, and routes with reliable
              charging access, because direct battery storage avoids the two chemical conversion steps (electrolysis
              and fuel cell) and achieves ~2–2.5× higher electricity-to-wheels efficiency.
            </p>
            <p>
              <strong>Where FCEVs show potential:</strong> Heavy-duty trucks, coaches, maritime vessels, and
              high-utilization fleets needing rapid 3–10 minute refueling, long range without multi-ton battery packs,
              or seasonal surplus-renewable energy buffering.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Beginner-Friendly Engineering Physics Curriculum */}
      <section className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 lg:p-6 space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-100">
            Educational Guide: Hydrogen Fuel-Cell Physics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Structured first-year engineering physics explanations of every system in this simulator.
          </p>
        </div>

        <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-[#070B12]">
          {CURRICULUM_TOPICS.map((topic, idx) => {
            const isOpen = openTopicIdx === idx;
            return (
              <div key={topic.title}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenTopicIdx(isOpen ? -1 : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-slate-200 hover:bg-slate-900/60 cursor-pointer"
                >
                  <span>{topic.title}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-cyan-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed space-y-2">
                    {topic.equation && (
                      <div className="font-mono text-cyan-300 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 w-fit">
                        {topic.equation}
                      </div>
                    )}
                    <p>{topic.body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Model Assumptions, Limitations, Asset Credits & GLB Replacement */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Model Assumptions, Limitations &amp; References
          </h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>
              <strong>LHV Basis Consistency:</strong> All hydrogen energy and efficiency figures use Hydrogen Lower
              Heating Value (33.33 kWh/kg) consistently. HHV (39.41 kWh/kg) is not mixed into the chain equations.
            </li>
            <li>
              <strong>Steady-State Analytical Model:</strong> Efficiency parameters represent lumped steady operating
              assumptions rather than transient polarization V–I curves or dynamic thermal finite-element models.
            </li>
            <li>
              <strong>Omitted Parasitic Loads:</strong> Air-compressor power, coolant pumps, and cabin HVAC loads are
              omitted from the simplified conversion chain equations and noted transparently.
            </li>
            <li>
              <strong>Illustrative 3D Animations:</strong> Moving particles depict energy and mass pathways conceptually
              rather than solving Navier–Stokes computational fluid dynamics (CFD).
            </li>
            <li>
              <strong>References:</strong> U.S. Department of Energy (Hydrogen and Fuel Cell Technologies Office),
              European Commission Joint Research Centre (Well-to-Wheels JEC reports), and Three.js official documentation.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
          <h2 className="font-display text-base font-semibold text-slate-100">
            3D Asset Credits &amp; Replacing <code className="font-mono text-cyan-300">public/car.glb</code>
          </h2>
          <p className="text-slate-400">
            Internal hydrogen components and the built-in fastback sedan fallback are original procedural Three.js
            geometries created for educational demonstration (not manufacturer CAD geometry).
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
            <li>
              To use your own vehicle model permanently, place a valid <code className="font-mono text-cyan-200">.glb</code>{' '}
              file at <code className="font-mono text-cyan-200">public/car.glb</code> and refresh the app.
            </li>
            <li>
              Or click <strong>Load .glb</strong> in the 3D Simulator toolbar to test any local{' '}
              <code className="font-mono text-cyan-200">.glb</code> / <code className="font-mono text-cyan-200">.gltf</code>{' '}
              file immediately in the browser.
            </li>
            <li>
              If an imported model faces a different direction, open the <strong>Calibration</strong> tab and select
              the matching <strong>Forward Axis</strong> (<code className="font-mono">+Z</code>,{' '}
              <code className="font-mono">-Z</code>, <code className="font-mono">+X</code>, or{' '}
              <code className="font-mono">-X</code>) — your alignment saves automatically to{' '}
              <code className="font-mono">localStorage</code>.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
};
