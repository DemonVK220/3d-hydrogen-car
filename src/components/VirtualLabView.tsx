import React, { useState } from 'react';
import { Download, Play, Plus, Trash2 } from 'lucide-react';
import {
  EXPERIMENTS,
  ExperimentId,
  ExperimentTrial,
  formatTrialsCsv,
  runExperimentTrial,
} from '../physics/experiments';
import { LabTrialChart } from './Charts';

const EXP_IDS: ExperimentId[] = ['exp_a', 'exp_b', 'exp_c', 'exp_d', 'exp_e'];

export const VirtualLabView: React.FC = () => {
  const [activeExpId, setActiveExpId] = useState<ExperimentId>('exp_d');
  const [trialsByExp, setTrialsByExp] = useState<Record<ExperimentId, ExperimentTrial[]>>({
    exp_a: [],
    exp_b: [],
    exp_c: [],
    exp_d: [
      runExperimentTrial('exp_d', 40, 1),
      runExperimentTrial('exp_d', 80, 2),
      runExperimentTrial('exp_d', 120, 3),
    ],
    exp_e: [],
  });
  const [indepValue, setIndepValue] = useState<number>(EXPERIMENTS.exp_d.defaultValue);

  const exp = EXPERIMENTS[activeExpId];
  const trials = trialsByExp[activeExpId];

  const handleSelectExp = (id: ExperimentId) => {
    setActiveExpId(id);
    setIndepValue(EXPERIMENTS[id].defaultValue);
  };

  const handleRecordTrial = () => {
    const nextNum = trials.length + 1;
    const trial = runExperimentTrial(activeExpId, indepValue, nextNum);
    setTrialsByExp((prev) => ({
      ...prev,
      [activeExpId]: [...prev[activeExpId], trial],
    }));
  };

  const handleRunSweep = () => {
    const generated: ExperimentTrial[] = [];
    let count = 1;
    for (let v = exp.min; v <= exp.max + 1e-6; v += exp.step) {
      generated.push(runExperimentTrial(activeExpId, Number(v.toFixed(2)), count++));
    }
    setTrialsByExp((prev) => ({
      ...prev,
      [activeExpId]: generated,
    }));
  };

  const handleClear = () => {
    setTrialsByExp((prev) => ({
      ...prev,
      [activeExpId]: [],
    }));
  };

  const handleExportCsv = () => {
    if (trials.length === 0) return;
    const csv = formatTrialsCsv(exp, trials);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hydrodrive-${activeExpId}-trials.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-6 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-100">
            Virtual Physics Laboratory
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-3xl">
            Run controlled parametric experiments on the analytical FCEV physics model. Outputs below are
            computed simulation results (not physical chassis-dynamometer measurements).
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXP_IDS.map((id) => {
            const active = id === activeExpId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectExp(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-800 bg-[#0B121F] text-slate-300 hover:text-white'
                }`}
              >
                {id.replace('exp_', 'Exp ').toUpperCase()}: {EXPERIMENTS[id].shortTitle}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scientific Protocol Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold text-cyan-300">{exp.title}</h2>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div>
              <span className="font-semibold text-slate-100">Objective: </span>
              {exp.objective}
            </div>
            <div>
              <span className="font-semibold text-slate-100">Hypothesis: </span>
              {exp.hypothesis}
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#070B12] p-3 space-y-1">
              <div>
                <span className="text-cyan-300 font-medium">Independent Variable: </span>
                {exp.independentVarLabel} ({exp.independentVarUnit})
              </div>
              <div>
                <span className="text-emerald-300 font-medium">Dependent Variable: </span>
                {exp.dependentVarLabel} ({exp.dependentVarUnit})
              </div>
              <div>
                <span className="text-slate-400 font-medium">Controlled Variables: </span>
                {exp.controlledSummary}
              </div>
            </div>
            <div>
              <span className="font-semibold text-slate-100">Procedure:</span>
              <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-400">
                {exp.procedure.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Trial Runner Controls */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="lab-indep" className="text-slate-200 font-medium">
                  {exp.independentVarLabel}
                </label>
                <span className="font-mono text-cyan-300">
                  {indepValue} {exp.independentVarUnit}
                </span>
              </div>
              <input
                id="lab-indep"
                type="range"
                min={exp.min}
                max={exp.max}
                step={exp.step}
                value={indepValue}
                onChange={(e) => setIndepValue(parseFloat(e.target.value))}
                className="eng-slider w-full"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRecordTrial}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Trial
              </button>
              <button
                type="button"
                onClick={handleRunSweep}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Run Full Sweep
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={trials.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-slate-400 text-xs hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Graph, Table & Interpretation */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5">
            <h3 className="font-display text-sm font-semibold text-slate-200 mb-2">
              Computed Simulation Response Curve
            </h3>
            <LabTrialChart experiment={exp} trials={trials} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0B121F] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-200">
                Recorded Trial Dataset ({trials.length} trials)
              </h3>
              <span className="text-[11px] text-slate-400">Computed simulation outputs</span>
            </div>

            <div className="overflow-x-auto max-h-56 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070B12] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-medium">Trial</th>
                    <th className="px-3 py-2 font-medium">
                      {exp.independentVarLabel} ({exp.independentVarUnit})
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {exp.dependentVarLabel} ({exp.dependentVarUnit})
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {exp.secondaryVarLabel} ({exp.secondaryVarUnit})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {trials.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center font-sans text-slate-500">
                        No trials recorded yet for this experiment.
                      </td>
                    </tr>
                  ) : (
                    trials.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/60">
                        <td className="px-3 py-2 text-slate-400">#{t.trialNumber}</td>
                        <td className="px-3 py-2 text-cyan-300">{t.independentValue.toFixed(2)}</td>
                        <td className="px-3 py-2 text-emerald-300">{t.dependentValue.toFixed(3)}</td>
                        <td className="px-3 py-2 text-amber-300">{t.secondaryValue.toFixed(3)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs text-slate-400 leading-relaxed">
              <div>
                <h4 className="font-semibold text-slate-200 mb-1">Engineering Interpretation</h4>
                <p>{exp.interpretation}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-200 mb-1">Model Limitations</h4>
                <p>{exp.limitations}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
