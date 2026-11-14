import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose, onStartTour }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0B121F] p-6 shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 id="help-modal-title" className="font-display text-xl font-semibold text-slate-100">
              How to Use HYDRODRIVE 3D
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Interactive Hydrogen Fuel-Cell Vehicle Engineering Simulator
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help dialog"
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-300 leading-relaxed">
          <div>
            <h3 className="font-semibold text-cyan-300">1. Inspecting the 3D Digital Twin</h3>
            <p className="mt-1 text-slate-400">
              Drag with the left mouse button to orbit around the vehicle, scroll to zoom, and right-drag to pan.
              Switch between <strong>Exterior</strong>, <strong>Cutaway</strong>, <strong>Internal Systems</strong>,{' '}
              <strong>Exploded View</strong>, and <strong>Energy Flow</strong> in the bottom dock.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-cyan-300">2. Clicking Components & Guided Tour</h3>
            <p className="mt-1 text-slate-400">
              Click any internal component directly in 3D (tank, fuel-cell stack, power electronics, buffer battery,
              traction motor, radiator, or drivetrain) to focus the camera and read its first-year engineering physics explanation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-cyan-300">3. Calibration & Replacing car.glb</h3>
            <p className="mt-1 text-slate-400">
              Open the <strong>Calibration</strong> tab in the bottom dock to fine-tune component X/Y/Z alignment,
              scale, or vehicle forward axis. Settings automatically persist in your browser. You can also upload any
              custom <code className="font-mono text-cyan-200">.glb</code> / <code className="font-mono text-cyan-200">.gltf</code> file or place one at{' '}
              <code className="font-mono text-cyan-200">public/car.glb</code>.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-cyan-300">4. Physics Engine & Virtual Lab</h3>
            <p className="mt-1 text-slate-400">
              Use <strong>Energy Chain</strong>, <strong>Performance</strong>, and <strong>Physics Lab</strong> to
              investigate electrolysis stoichiometry, stage-by-stage LHV conversion losses, tractive resistance forces,
              and export CSV trial datasets for your physics report.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartTour();
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            Start Component Tour
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
