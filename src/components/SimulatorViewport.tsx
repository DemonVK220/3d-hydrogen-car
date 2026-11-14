import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  HelpCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Upload,
  X,
} from 'lucide-react';
import { EnergyChainResult } from '../physics/energyChain';
import { VehicleDynamicsInput, VehicleDynamicsResult } from '../physics/vehicleDynamics';
import {
  COMPONENT_CATALOG,
  COMPONENT_ORDER,
  ComponentId,
} from '../three/componentCatalog';
import {
  CalibrationConfig,
  ForwardAxisOption,
  getDefaultCalibration,
} from '../three/calibration';
import { FlowAnimationState } from '../three/energyFlowParticles';
import {
  CameraPreset,
  HydroDriveSceneManager,
  ViewMode,
} from '../three/sceneManager';

type DockTab = 'view' | 'rotation_flow' | 'drive' | 'calibration';

interface SimulatorViewportProps {
  chainResult: EnergyChainResult;
  dynamicsInput: VehicleDynamicsInput;
  dynamicsResult: VehicleDynamicsResult;
  onChangeDynamics: (patch: Partial<VehicleDynamicsInput>) => void;
  calibration: CalibrationConfig;
  onChangeCalibration: (cfg: CalibrationConfig) => void;
  selectedComponent: ComponentId | null;
  onSelectComponent: (id: ComponentId | null) => void;
  tourActive: boolean;
  onSetTourActive: (active: boolean) => void;
  onOpenHelp: () => void;
}

const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'cutaway', label: 'Cutaway' },
  { id: 'internal', label: 'Internal' },
  { id: 'exploded', label: 'Exploded' },
  { id: 'energy_flow', label: 'Energy Flow' },
];

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'isometric', label: 'Iso' },
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
];

const FLOW_STEP_LABELS = [
  '1. H₂ Gas (Tank → Stack)',
  '2. O₂ Air Intake (Grille → Stack)',
  '3. DC/AC Electricity (Stack ↔ Battery → Motor)',
  '4. Water Vapor Exhaust (2H₂O)',
  '5. Thermal Heat Rejection (Radiator)',
];

export const SimulatorViewport: React.FC<SimulatorViewportProps> = ({
  chainResult,
  dynamicsInput,
  dynamicsResult,
  onChangeDynamics,
  calibration,
  onChangeCalibration,
  selectedComponent,
  onSelectComponent,
  tourActive,
  onSetTourActive,
  onOpenHelp,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HydroDriveSceneManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Store latest callback in ref so WebGL lifecycle never tears down on state changes
  const selectCompRef = useRef(onSelectComponent);
  selectCompRef.current = onSelectComponent;

  const [dockOpen, setDockOpen] = useState(true);
  const [dockTab, setDockTab] = useState<DockTab>('view');
  const [viewMode, setViewMode] = useState<ViewMode>('cutaway');
  const [bodyOpacity, setBodyOpacity] = useState(0.24);
  const [carRot, setCarRot] = useState({ x: 0, y: 0, z: 0 });
  const [autoRotate, setAutoRotate] = useState(false);

  const [drivingActive, setDrivingActive] = useState(false);
  const [flowState, setFlowState] = useState<FlowAnimationState>({
    playing: true,
    speedMultiplier: 1.0,
    mode: 'continuous',
    activeStepIndex: 0,
  });

  const [calibTarget, setCalibTarget] = useState<ComponentId>('fuel_cell');
  const [visibilityMap, setVisibilityMap] = useState<Record<ComponentId, boolean>>({
    h2_tank: true,
    fuel_cell: true,
    power_electronics: true,
    buffer_battery: true,
    electric_motor: true,
    thermal_system: true,
    drivetrain: true,
  });

  const [vehicleStatus, setVehicleStatus] = useState<{
    message: string;
    hasSeparableWheels: boolean;
    loading: boolean;
  }>({
    message: 'Initializing 3D vehicle twin...',
    hasSeparableWheels: true,
    loading: true,
  });
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDetailedPhysics, setShowDetailedPhysics] = useState(false);

  // Mount Three.js scene once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const manager = new HydroDriveSceneManager(mountEl, calibration, {
      onSelectComponent: (id) => selectCompRef.current(id),
      onVehicleLoaded: (info) =>
        setVehicleStatus({
          message: info.message,
          hasSeparableWheels: info.hasSeparableWheels,
          loading: false,
        }),
      onWebGLError: (msg) => setWebglError(msg),
    });
    sceneRef.current = manager;

    return () => {
      manager.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut 'H' to toggle HUD dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sync driving & flow state to Three.js without remounting
  useEffect(() => {
    sceneRef.current?.setDrivingState({
      active: drivingActive,
      speedMs: drivingActive ? dynamicsResult.speedMs : 0,
      slopeDeg: dynamicsResult.slopeAngleDeg,
      powerDemandFraction: Math.min(
        1.5,
        Math.max(0.15, Math.abs(dynamicsResult.wheelPowerKW) / Math.max(dynamicsInput.fuelCellMaxPowerKW, 1)),
      ),
      isRegenerating: dynamicsResult.isRegenerating,
    });
  }, [drivingActive, dynamicsResult, dynamicsInput.fuelCellMaxPowerKW]);

  useEffect(() => {
    sceneRef.current?.setFlowAnimationState(flowState);
  }, [flowState]);

  useEffect(() => {
    sceneRef.current?.setCalibration(calibration);
  }, [calibration]);

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
  };

  const handleOpacity = (val: number) => {
    setBodyOpacity(val);
    sceneRef.current?.setBodyOpacity(val);
  };

  const handleCarRot = (axis: 'x' | 'y' | 'z', deg: number) => {
    const next = { ...carRot, [axis]: deg };
    setCarRot(next);
    sceneRef.current?.setCarRotationDeg(next.x, next.y, next.z);
  };

  const handleResetRotation = () => {
    setCarRot({ x: 0, y: 0, z: 0 });
    setAutoRotate(false);
    sceneRef.current?.setAutoRotateCar(false);
    sceneRef.current?.setCarRotationDeg(0, 0, 0);
  };

  const handleSelectAndFocus = (id: ComponentId) => {
    onSelectComponent(id);
    sceneRef.current?.focusComponent(id);
    if (viewMode === 'exterior') {
      handleViewMode('cutaway');
    }
  };

  const handleTourStep = (dir: 1 | -1) => {
    const currentIndex = selectedComponent ? COMPONENT_ORDER.indexOf(selectedComponent) : -1;
    const nextIndex = (currentIndex + dir + COMPONENT_ORDER.length) % COMPONENT_ORDER.length;
    handleSelectAndFocus(COMPONENT_ORDER[nextIndex]);
  };

  const handleToggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleScreenshot = () => {
    const url = sceneRef.current?.captureScreenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `hydrodrive-3d-${viewMode}.png`;
    a.click();
  };

  const handleGlbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVehicleStatus((prev) => ({ ...prev, loading: true, message: `Loading ${file.name}...` }));
    void sceneRef.current?.loadCustomGlbFile(file);
  };

  const selectedMeta = selectedComponent ? COMPONENT_CATALOG[selectedComponent] : null;
  const activeCalib = calibration.components[calibTarget];

  const updateCalibField = (field: keyof typeof activeCalib, value: number) => {
    onChangeCalibration({
      ...calibration,
      components: {
        ...calibration.components,
        [calibTarget]: {
          ...activeCalib,
          [field]: value,
        },
      },
    });
  };

  return (
    <section
      ref={stageRef}
      className="relative w-full h-[calc(100vh-3.5rem)] min-h-[580px] bg-[#070B12] overflow-hidden select-none"
      data-testid="simulator-viewport"
      data-view-mode={viewMode}
    >
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        data-testid="webgl-canvas-mount"
      />

      {/* WebGL Error Fallback */}
      {webglError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#070B12] p-6">
          <div className="max-w-md rounded-xl border border-rose-800/70 bg-slate-900 p-6 text-center">
            <h2 className="font-display text-lg font-semibold text-rose-300">WebGL Unavailable</h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
            <p className="mt-2 text-xs text-slate-400">
              You can still use the Energy Chain, Performance, Physics Lab, and Compare &amp; Learn sections.
            </p>
          </div>
        </div>
      )}

      {/* Top-Left Compact Telemetry & Utility Ribbon (solid/rgba without backdrop-blur) */}
      <div
        className={`absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[calc(100vw-1.5rem)] ${
          selectedMeta ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-[#0B121F]/92 px-3 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
            <span>
              <span className="text-slate-400">Speed </span>
              <strong className="text-slate-100">{drivingActive ? dynamicsInput.speedKmh.toFixed(0) : '0'} km/h</strong>
            </span>
            <span>
              <span className="text-slate-400">Wheel Pwr </span>
              <strong className="text-amber-300">
                {drivingActive ? dynamicsResult.wheelPowerKW.toFixed(1) : '0.0'} kW
              </strong>
            </span>
            <span>
              <span className="text-slate-400">H₂ Use </span>
              <strong className="text-cyan-300">
                {drivingActive ? dynamicsResult.h2ConsumptionKgPer100Km.toFixed(2) : '0.00'} kg/100km
              </strong>
            </span>
            <span className="hidden sm:inline">
              <span className="text-slate-400">Well-to-Wheel </span>
              <strong className="text-emerald-300">
                {(chainResult.boundaries.electricityToWheels * 100).toFixed(1)}%
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onSetTourActive(true);
              handleSelectAndFocus(COMPONENT_ORDER[0]);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0B121F]/92 text-xs font-medium text-cyan-300 hover:border-cyan-500/60 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            Guided Tour
          </button>
          <button
            type="button"
            onClick={handleScreenshot}
            aria-label="Capture 3D viewport screenshot"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0B121F]/92 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            Screenshot
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload custom GLB or GLTF car model"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0B121F]/92 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Load .glb
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleGlbUpload}
          />
          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0B121F]/92 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Open simulation help"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0B121F]/92 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
          </button>
        </div>

        <p className="hidden sm:block text-[11px] text-slate-400 bg-[#0B121F]/80 border border-slate-800/70 rounded px-2.5 py-1 w-fit">
          {vehicleStatus.loading ? 'Loading 3D asset...' : vehicleStatus.message}
        </p>
      </div>

      {/* Selected Component Inspector Drawer (Only visible when a component is selected) */}
      {selectedMeta && (
        <aside
          aria-label="Selected component inspector"
          className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 z-30 sm:w-[330px] rounded-xl border border-slate-800 bg-[#0B121F]/95 p-4 shadow-xl max-h-[38vh] sm:max-h-[64vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="text-[11px] font-medium text-slate-400">
                {selectedMeta.systemRole} · {selectedMeta.typicalEfficiencyLabel}
              </div>
              <h2 className="font-display text-base font-semibold text-slate-100 mt-0.5">
                {selectedMeta.name}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close component details"
              onClick={() => {
                onSetTourActive(false);
                onSelectComponent(null);
                sceneRef.current?.clearHighlight();
              }}
              className="p-1.5 rounded border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-300 leading-relaxed">{selectedMeta.summary}</p>

          <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-800 bg-[#070B12] p-2.5 text-xs">
            <div>
              <span className="text-slate-400">Input: </span>
              <span className="text-cyan-300">{selectedMeta.inputForm}</span>
            </div>
            <div>
              <span className="text-slate-400">Output: </span>
              <span className="text-amber-300">{selectedMeta.outputForm}</span>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDetailedPhysics((v) => !v)}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              {showDetailedPhysics ? 'Hide detailed physics' : 'Show detailed physics explanation'}
            </button>
            {showDetailedPhysics && (
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {selectedMeta.detailedPhysics}
              </p>
            )}
          </div>

          {tourActive && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleTourStep(-1)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="font-mono text-[11px] text-slate-400">
                {COMPONENT_ORDER.indexOf(selectedMeta.id) + 1} / {COMPONENT_ORDER.length}
              </span>
              <button
                type="button"
                onClick={() => handleTourStep(1)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-medium hover:bg-cyan-400 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Center Viewport Occlusion) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(960px,96vw)] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg border border-b-0 border-slate-800 bg-[#0B121F]/95 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer"
        >
          {dockOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {dockOpen ? 'Hide Controls (H)' : 'Show Controls (H)'}
        </button>

        {dockOpen && (
          <div className="w-full rounded-xl border border-slate-800 bg-[#0B121F]/95 p-3.5 shadow-2xl max-h-[42vh] sm:max-h-none overflow-y-auto">
            {/* Dock Tab Strip + Quick Component Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-1 bg-[#070B12] p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'view', label: 'View & Camera' },
                    { id: 'rotation_flow', label: 'Rotation & Flow' },
                    { id: 'drive', label: 'Driving Demo' },
                    { id: 'calibration', label: 'Calibration' },
                  ] as Array<{ id: DockTab; label: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDockTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dockTab === t.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Quick Component Jump Strip */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                {COMPONENT_ORDER.map((id) => {
                  const meta = COMPONENT_CATALOG[id];
                  const active = selectedComponent === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectAndFocus(id)}
                      className={`px-2 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {meta.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab 1: View Modes, Transparency & Camera Presets */}
            {dockTab === 'view' && (
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {VIEW_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleViewMode(m.id)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap cursor-pointer transition-colors ${
                          viewMode === m.id
                            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2.5 min-w-[220px]">
                    <label htmlFor="body-opacity" className="text-xs text-slate-400 whitespace-nowrap">
                      Body Opacity
                    </label>
                    <input
                      id="body-opacity"
                      type="range"
                      min={0.08}
                      max={1}
                      step={0.02}
                      value={bodyOpacity}
                      onChange={(e) => handleOpacity(parseFloat(e.target.value))}
                      className="eng-slider flex-1"
                    />
                    <span className="font-mono text-xs text-slate-300 w-10 text-right">
                      {Math.round(bodyOpacity * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <span className="text-[11px] text-slate-400">Camera Presets</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {CAMERA_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => sceneRef.current?.setCameraPreset(p.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => sceneRef.current?.setCameraPreset('isometric')}
                      className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-700 text-cyan-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Reset Camera
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 3-Axis Rotation & Energy Flow Controls */}
            {dockTab === 'rotation_flow' && (
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Vehicle 3-Axis Object Rotation</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoRotate;
                          setAutoRotate(next);
                          sceneRef.current?.setAutoRotateCar(next);
                        }}
                        className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                          autoRotate
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                            : 'border-slate-700 text-slate-300'
                        }`}
                      >
                        {autoRotate ? 'Pause Auto' : 'Auto Rotate'}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetRotation}
                        className="px-2 py-1 text-[11px] rounded border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Reset Rotation
                      </button>
                    </div>
                  </div>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <div key={axis} className="flex items-center gap-2">
                      <label htmlFor={`rot-${axis}`} className="font-mono text-xs text-slate-400 w-10 uppercase">
                        {axis}-Axis
                      </label>
                      <input
                        id={`rot-${axis}`}
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={carRot[axis]}
                        onChange={(e) => handleCarRot(axis, parseFloat(e.target.value))}
                        className="eng-slider flex-1"
                      />
                      <span className="font-mono text-xs text-slate-200 w-12 text-right">
                        {carRot[axis]}°
                      </span>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-6 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      Energy Flow Animation (Illustrative Paths, Non-CFD)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (viewMode !== 'energy_flow') handleViewMode('energy_flow');
                          setFlowState((s) => ({ ...s, playing: !s.playing }));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-cyan-500 text-slate-950 font-medium cursor-pointer"
                      >
                        {flowState.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {flowState.playing ? 'Pause' : 'Start'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFlowState({
                            playing: true,
                            speedMultiplier: 1.0,
                            mode: 'continuous',
                            activeStepIndex: 0,
                          })
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-700 text-slate-300 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'continuous', label: 'Continuous' },
                        { id: 'step_by_step', label: 'Step-by-Step' },
                        { id: 'slow_motion', label: 'Slow Motion' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (viewMode !== 'energy_flow') handleViewMode('energy_flow');
                          setFlowState((s) => ({ ...s, mode: m.id, playing: true }));
                        }}
                        className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                          flowState.mode === m.id
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                    {flowState.mode === 'step_by_step' && (
                      <button
                        type="button"
                        onClick={() =>
                          setFlowState((s) => ({ ...s, activeStepIndex: (s.activeStepIndex + 1) % 5 }))
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-cyan-500/60 text-cyan-300 cursor-pointer"
                      >
                        <SkipForward className="w-3 h-3" />
                        Next Step ({flowState.activeStepIndex + 1}/5)
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="flow-speed" className="text-xs text-slate-400 whitespace-nowrap">
                      Flow Speed
                    </label>
                    <input
                      id="flow-speed"
                      type="range"
                      min={0.2}
                      max={2.5}
                      step={0.1}
                      value={flowState.speedMultiplier}
                      onChange={(e) =>
                        setFlowState((s) => ({ ...s, speedMultiplier: parseFloat(e.target.value) }))
                      }
                      className="eng-slider flex-1"
                    />
                    <span className="font-mono text-xs text-slate-200 w-10 text-right">
                      {flowState.speedMultiplier.toFixed(1)}×
                    </span>
                  </div>
                  {flowState.mode === 'step_by_step' && (
                    <div className="text-[11px] text-cyan-300">
                      Active Stage: {FLOW_STEP_LABELS[flowState.activeStepIndex]}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Animated Driving Mode */}
            {dockTab === 'drive' && (
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-3 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDrivingActive((d) => !d)}
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      drivingActive
                        ? 'bg-rose-500 text-white hover:bg-rose-400'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    }`}
                  >
                    {drivingActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {drivingActive ? 'Stop Driving' : 'Start Driving Demo'}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    {vehicleStatus.hasSeparableWheels
                      ? 'Wheels rotate proportionally (ω = v / r).'
                      : 'Merged GLB wheels: road & motor shaft animate; steady-state physics runs independently.'}
                  </span>
                </div>

                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="drive-speed" className="text-slate-400">Speed</label>
                      <span className="font-mono text-slate-200">{dynamicsInput.speedKmh.toFixed(0)} km/h</span>
                    </div>
                    <input
                      id="drive-speed"
                      type="range"
                      min={0}
                      max={160}
                      step={5}
                      value={dynamicsInput.speedKmh}
                      onChange={(e) => onChangeDynamics({ speedKmh: parseFloat(e.target.value) })}
                      className="eng-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="drive-accel" className="text-slate-400">Accel</label>
                      <span className="font-mono text-slate-200">{dynamicsInput.accelerationMs2.toFixed(1)} m/s²</span>
                    </div>
                    <input
                      id="drive-accel"
                      type="range"
                      min={-2.5}
                      max={2.5}
                      step={0.1}
                      value={dynamicsInput.accelerationMs2}
                      onChange={(e) => onChangeDynamics({ accelerationMs2: parseFloat(e.target.value) })}
                      className="eng-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="drive-grade" className="text-slate-400">Gradient</label>
                      <span className="font-mono text-slate-200">{dynamicsInput.roadGradientPercent.toFixed(1)}%</span>
                    </div>
                    <input
                      id="drive-grade"
                      type="range"
                      min={-10}
                      max={10}
                      step={0.5}
                      value={dynamicsInput.roadGradientPercent}
                      onChange={(e) => onChangeDynamics({ roadGradientPercent: parseFloat(e.target.value) })}
                      className="eng-slider w-full"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3 rounded-lg border border-slate-800 bg-[#070B12] p-2.5 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tractive Pwr</span>
                    <span className="text-amber-300">{dynamicsResult.wheelPowerKW.toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">H₂ Demand</span>
                    <span className="text-cyan-300">{dynamicsResult.h2ConsumptionKgPer100Km.toFixed(2)} kg/100km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Range</span>
                    <span className="text-emerald-300">{dynamicsResult.estimatedRangeKm.toFixed(0)} km</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Component Position Calibration Mode (persists in localStorage) */}
            {dockTab === 'calibration' && (
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="calib-comp" className="text-xs text-slate-400">Component</label>
                    <select
                      id="calib-comp"
                      value={calibTarget}
                      onChange={(e) => setCalibTarget(e.target.value as ComponentId)}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                    >
                      {COMPONENT_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {COMPONENT_CATALOG[id].shortName}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="calib-axis" className="text-xs text-slate-400 ml-2">Forward Axis</label>
                    <select
                      id="calib-axis"
                      value={calibration.forwardAxis}
                      onChange={(e) =>
                        onChangeCalibration({
                          ...calibration,
                          forwardAxis: e.target.value as ForwardAxisOption,
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                    >
                      <option value="posZ">+Z Forward</option>
                      <option value="negZ">-Z Forward</option>
                      <option value="posX">+X Forward</option>
                      <option value="negX">-X Forward</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const nextVis = !visibilityMap[calibTarget];
                        setVisibilityMap((v) => ({ ...v, [calibTarget]: nextVis }));
                        sceneRef.current?.setComponentVisibility(calibTarget, nextVis);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-700 text-slate-300 cursor-pointer"
                    >
                      {visibilityMap[calibTarget] ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {visibilityMap[calibTarget] ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onChangeCalibration(getDefaultCalibration())}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-700 text-cyan-300 hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Recommended
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                  {(
                    [
                      { key: 'x', label: 'Pos X (m)', min: -1.5, max: 1.5, step: 0.02 },
                      { key: 'y', label: 'Pos Y (m)', min: 0.05, max: 1.8, step: 0.02 },
                      { key: 'z', label: 'Pos Z (m)', min: -2.2, max: 2.2, step: 0.02 },
                      { key: 'rx', label: 'Rot X (°)', min: -180, max: 180, step: 5 },
                      { key: 'ry', label: 'Rot Y (°)', min: -180, max: 180, step: 5 },
                      { key: 'rz', label: 'Rot Z (°)', min: -180, max: 180, step: 5 },
                      { key: 'scale', label: 'Scale', min: 0.4, max: 2.0, step: 0.05 },
                    ] as const
                  ).map((ctrl) => (
                    <div key={ctrl.key}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <label htmlFor={`calib-${ctrl.key}`} className="text-slate-400">
                          {ctrl.label}
                        </label>
                        <span className="font-mono text-slate-200">
                          {activeCalib[ctrl.key].toFixed(ctrl.key.startsWith('r') ? 0 : 2)}
                        </span>
                      </div>
                      <input
                        id={`calib-${ctrl.key}`}
                        type="range"
                        min={ctrl.min}
                        max={ctrl.max}
                        step={ctrl.step}
                        value={activeCalib[ctrl.key]}
                        onChange={(e) => updateCalibField(ctrl.key, parseFloat(e.target.value))}
                        className="eng-slider w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
