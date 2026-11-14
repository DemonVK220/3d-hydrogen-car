import React from 'react';
import { EnergyChainResult } from '../physics/energyChain';
import { PathwayComparisonResult } from '../physics/comparison';
import { ExperimentDefinition, ExperimentTrial } from '../physics/experiments';

export const EnergySankeyChart: React.FC<{ chain: EnergyChainResult }> = ({ chain }) => {
  const width = 760;
  const height = 270;
  const leftPad = 16;
  const stageWidth = 104;
  const maxBarH = 148;
  const topY = 48;

  const nodes = [
    { label: 'Input Elec.', energy: chain.inputEnergyKWh, loss: 0, color: '#94A3B8' },
    ...chain.stages.map((s) => ({
      label: s.shortLabel,
      energy: s.energyOutKWh,
      loss: s.lossKWh,
      color: s.colorHex,
    })),
  ];

  const colCount = nodes.length;
  const colStep = (width - leftPad * 2 - 80) / (colCount - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[600px] h-auto select-none"
        role="img"
        aria-label="Energy conversion Sankey flow chart from electrical input to wheel output"
      >
        {/* Connecting ribbons */}
        {nodes.slice(0, -1).map((node, i) => {
          const next = nodes[i + 1];
          const x1 = leftPad + i * colStep + 68;
          const x2 = leftPad + (i + 1) * colStep;
          const h1 = Math.max(4, (node.energy / chain.inputEnergyKWh) * maxBarH);
          const h2 = Math.max(4, (next.energy / chain.inputEnergyKWh) * maxBarH);
          const y1 = topY;
          const y2 = topY;
          const midX = (x1 + x2) / 2;

          // Useful flow ribbon
          const pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2} L ${x2} ${y2 + h2} C ${midX} ${y2 + h2}, ${midX} ${y1 + h2}, ${x1} ${y1 + h2} Z`;
          // Loss branch dropping downward
          const lossH = Math.max(2, h1 - h2);
          const lossX = x1 + 10;
          const lossEndY = topY + maxBarH + 26;
          const lossPath = `M ${x1} ${y1 + h2} Q ${lossX + 8} ${y1 + h1 + 12}, ${lossX + 18} ${lossEndY} L ${lossX + 18 + Math.min(26, lossH * 0.6)} ${lossEndY} Q ${lossX + 14} ${y1 + h1 + 4}, ${x1} ${y1 + h1} Z`;

          return (
            <g key={node.label}>
              <path d={pathD} fill={next.color} fillOpacity={0.34} />
              {next.loss > 0.05 && (
                <>
                  <path d={lossPath} fill="#F43F5E" fillOpacity={0.42} />
                  <text
                    x={lossX + 20}
                    y={lossEndY + 14}
                    fill="#FDA4AF"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    -{next.loss.toFixed(1)} kWh
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Stage bars & labels */}
        {nodes.map((node, i) => {
          const x = leftPad + i * colStep;
          const barH = Math.max(4, (node.energy / chain.inputEnergyKWh) * maxBarH);
          return (
            <g key={node.label}>
              <rect
                x={x}
                y={topY}
                width={68}
                height={barH}
                rx={3}
                fill={node.color}
                fillOpacity={0.92}
              />
              <text
                x={x}
                y={topY - 22}
                fill="#CBD5E1"
                fontSize="10.5"
                fontWeight="600"
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {node.label.slice(0, stageWidth / 8)}
              </text>
              <text
                x={x}
                y={topY - 8}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {node.energy.toFixed(1)} kWh
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const LossesBarChart: React.FC<{ chain: EnergyChainResult }> = ({ chain }) => {
  const maxLoss = Math.max(...chain.stages.map((s) => s.lossKWh), 1);

  return (
    <div className="space-y-2.5">
      {chain.stages.map((stage) => {
        const pctOfInput = (stage.lossKWh / chain.inputEnergyKWh) * 100;
        const barWidthPct = (stage.lossKWh / maxLoss) * 100;
        return (
          <div key={stage.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{stage.shortLabel}</span>
              <span className="font-mono text-rose-300">
                {stage.lossKWh.toFixed(2)} kWh ({pctOfInput.toFixed(1)}% of input)
              </span>
            </div>
            <div className="h-2 w-full rounded bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-500/80 transition-all duration-200"
                style={{ width: `${Math.max(2, barWidthPct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const PathwayComparisonChart: React.FC<{ comparison: PathwayComparisonResult }> = ({
  comparison,
}) => {
  const eIn = Math.max(comparison.inputEnergyKWh, 1);
  const fcevWheelPct = (comparison.fcev.wheelEnergyKWh / eIn) * 100;
  const fcevLossPct = (comparison.fcev.totalLossesKWh / eIn) * 100;
  const bevWheelPct = (comparison.bev.wheelEnergyKWh / eIn) * 100;
  const bevLossPct = (comparison.bev.totalLossesKWh / eIn) * 100;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-cyan-300">Hydrogen Fuel-Cell Vehicle (FCEV)</span>
          <span className="font-mono text-slate-200">
            {comparison.fcev.wheelEnergyKWh.toFixed(1)} kWh wheels ({fcevWheelPct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-7 w-full rounded bg-slate-900 border border-slate-800 flex overflow-hidden">
          <div
            className="h-full bg-cyan-500/85 flex items-center pl-2 text-[11px] font-mono text-slate-950 font-semibold"
            style={{ width: `${fcevWheelPct}%` }}
          >
            {fcevWheelPct >= 14 ? `${fcevWheelPct.toFixed(1)}%` : ''}
          </div>
          <div
            className="h-full bg-rose-500/30 flex items-center justify-end pr-2 text-[11px] font-mono text-rose-200"
            style={{ width: `${fcevLossPct}%` }}
          >
            Losses: {comparison.fcev.totalLossesKWh.toFixed(1)} kWh
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-emerald-300">Battery Electric Vehicle (BEV)</span>
          <span className="font-mono text-slate-200">
            {comparison.bev.wheelEnergyKWh.toFixed(1)} kWh wheels ({bevWheelPct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-7 w-full rounded bg-slate-900 border border-slate-800 flex overflow-hidden">
          <div
            className="h-full bg-emerald-500/85 flex items-center pl-2 text-[11px] font-mono text-slate-950 font-semibold"
            style={{ width: `${bevWheelPct}%` }}
          >
            {bevWheelPct >= 14 ? `${bevWheelPct.toFixed(1)}%` : ''}
          </div>
          <div
            className="h-full bg-rose-500/30 flex items-center justify-end pr-2 text-[11px] font-mono text-rose-200"
            style={{ width: `${bevLossPct}%` }}
          >
            Losses: {comparison.bev.totalLossesKWh.toFixed(1)} kWh
          </div>
        </div>
      </div>
    </div>
  );
};

export const PowerSpeedChart: React.FC<{
  data: Array<{ speedKmh: number; wheelPowerKW: number; h2PowerKW: number }>;
  currentSpeedKmh: number;
}> = ({ data, currentSpeedKmh }) => {
  const width = 520;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 34, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxSpeed = Math.max(...data.map((d) => d.speedKmh), 160);
  const maxPower = Math.max(...data.map((d) => Math.max(d.wheelPowerKW, d.h2PowerKW)), 20);

  const sx = (v: number) => pad.left + (v / maxSpeed) * plotW;
  const sy = (p: number) => pad.top + plotH - (Math.max(0, p) / maxPower) * plotH;

  const wheelPath = data
    .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${sx(d.speedKmh).toFixed(1)} ${sy(d.wheelPowerKW).toFixed(1)}`)
    .join(' ');
  const h2Path = data
    .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${sx(d.speedKmh).toFixed(1)} ${sy(d.h2PowerKW).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Power demand versus vehicle speed chart">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {(maxPower * frac).toFixed(0)}
            </text>
          </g>
        );
      })}
      {[0, 40, 80, 120, 160].map((spd) => (
        <text key={spd} x={sx(spd)} y={height - 10} textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
          {spd}
        </text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 0} textAnchor="middle" fill="#94A3B8" fontSize="10">
        Speed (km/h)
      </text>
      <text x={14} y={pad.top + plotH / 2} transform={`rotate(-90 14 ${pad.top + plotH / 2})`} textAnchor="middle" fill="#94A3B8" fontSize="10">
        Power (kW)
      </text>

      <path d={h2Path} fill="none" stroke="#06B6D4" strokeWidth="2.2" />
      <path d={wheelPath} fill="none" stroke="#F59E0B" strokeWidth="2.2" />
      <line
        x1={sx(currentSpeedKmh)}
        y1={pad.top}
        x2={sx(currentSpeedKmh)}
        y2={pad.top + plotH}
        stroke="#E2E8F0"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <g transform={`translate(${pad.left + 10}, ${pad.top + 8})`}>
        <rect width="12" height="3" y="4" fill="#06B6D4" />
        <text x="18" y="9" fill="#CBD5E1" fontSize="10">H₂ Chemical Power (kW)</text>
        <rect width="12" height="3" y="18" fill="#F59E0B" />
        <text x="18" y="23" fill="#CBD5E1" fontSize="10">Wheel Tractive Power (kW)</text>
      </g>
    </svg>
  );
};

export const RangeCapacityChart: React.FC<{
  data: Array<{ capacityKg: number; rangeKm: number }>;
  currentCapacityKg: number;
}> = ({ data, currentCapacityKg }) => {
  const width = 520;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 34, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxCap = Math.max(...data.map((d) => d.capacityKg), 10);
  const maxRange = Math.max(...data.map((d) => d.rangeKm), 100);

  const sx = (c: number) => pad.left + (c / maxCap) * plotW;
  const sy = (r: number) => pad.top + plotH - (r / maxRange) * plotH;

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.capacityKg).toFixed(1)} ${sy(d.rangeKm).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Estimated vehicle range versus hydrogen capacity chart">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {(maxRange * frac).toFixed(0)}
            </text>
          </g>
        );
      })}
      {[2, 4, 6, 8, 10].map((kg) => (
        <text key={kg} x={sx(kg)} y={height - 10} textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
          {kg}
        </text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 0} textAnchor="middle" fill="#94A3B8" fontSize="10">
        Usable Hydrogen Mass (kg)
      </text>
      <text x={14} y={pad.top + plotH / 2} transform={`rotate(-90 14 ${pad.top + plotH / 2})`} textAnchor="middle" fill="#94A3B8" fontSize="10">
        Range (km)
      </text>

      <path d={path} fill="none" stroke="#10B981" strokeWidth="2.4" />
      <line
        x1={sx(currentCapacityKg)}
        y1={pad.top}
        x2={sx(currentCapacityKg)}
        y2={pad.top + plotH}
        stroke="#E2E8F0"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
    </svg>
  );
};

export const LabTrialChart: React.FC<{
  experiment: ExperimentDefinition;
  trials: ExperimentTrial[];
}> = ({ experiment, trials }) => {
  const width = 560;
  const height = 230;
  const pad = { top: 22, right: 24, bottom: 38, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const sorted = [...trials].sort((a, b) => a.independentValue - b.independentValue);
  const minX = experiment.min;
  const maxX = experiment.max;
  const maxY = Math.max(...sorted.map((t) => t.dependentValue), 10) * 1.12;

  const sx = (x: number) => pad.left + ((x - minX) / Math.max(maxX - minX, 1)) * plotW;
  const sy = (y: number) => pad.top + plotH - (Math.max(0, y) / maxY) * plotH;

  const linePath = sorted
    .map((t, i) => `${i === 0 ? 'M' : 'L'} ${sx(t.independentValue).toFixed(1)} ${sy(t.dependentValue).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Experiment plot for ${experiment.title}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.top + plotH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {(maxY * f).toFixed(1)}
            </text>
          </g>
        );
      })}

      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const val = minX + (maxX - minX) * f;
        return (
          <text key={f} x={sx(val)} y={height - 16} textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace">
            {val.toFixed(0)}
          </text>
        );
      })}

      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" fill="#94A3B8" fontSize="10.5">
        {experiment.independentVarLabel} ({experiment.independentVarUnit})
      </text>
      <text x={15} y={pad.top + plotH / 2} transform={`rotate(-90 15 ${pad.top + plotH / 2})`} textAnchor="middle" fill="#94A3B8" fontSize="10.5">
        {experiment.dependentVarLabel} ({experiment.dependentVarUnit})
      </text>

      {sorted.length > 1 && <path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="2.2" />}
      {sorted.map((t) => (
        <g key={t.id}>
          <circle cx={sx(t.independentValue)} cy={sy(t.dependentValue)} r={4.5} fill="#22D3EE" stroke="#070B12" strokeWidth="1.5" />
        </g>
      ))}
      {sorted.length === 0 && (
        <text x={pad.left + plotW / 2} y={pad.top + plotH / 2} textAnchor="middle" fill="#64748B" fontSize="12">
          Click &quot;Record Trial&quot; or &quot;Run Sweep&quot; to plot simulated data points
        </text>
      )}
    </svg>
  );
};
