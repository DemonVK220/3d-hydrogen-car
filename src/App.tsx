import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_ENERGY_CHAIN_INPUT,
  EnergyChainInput,
  calculateEnergyChain,
} from './physics/energyChain';
import {
  DEFAULT_VEHICLE_DYNAMICS_INPUT,
  VehicleDynamicsInput,
  calculateVehicleDynamics,
} from './physics/vehicleDynamics';
import {
  CalibrationConfig,
  getDefaultCalibration,
  loadCalibration,
  saveCalibration,
} from './three/calibration';
import { ComponentId } from './three/componentCatalog';
import { AppSection, MobileNavStrip, TopBar } from './components/TopBar';
import { SimulatorViewport } from './components/SimulatorViewport';
import { EnergyElectrolysisView } from './components/EnergyElectrolysisView';
import { VehiclePerformanceView } from './components/VehiclePerformanceView';
import { VirtualLabView } from './components/VirtualLabView';
import { CompareLearnView } from './components/CompareLearnView';
import { HelpModal } from './components/HelpModal';

const PARAMS_STORAGE_KEY = 'hydrodrive3d.params.v1';

function loadSavedParams(): {
  chain: EnergyChainInput;
  dynamics: VehicleDynamicsInput;
} {
  try {
    const raw = window.localStorage.getItem(PARAMS_STORAGE_KEY);
    if (!raw) {
      return {
        chain: DEFAULT_ENERGY_CHAIN_INPUT,
        dynamics: DEFAULT_VEHICLE_DYNAMICS_INPUT,
      };
    }
    const parsed = JSON.parse(raw) as {
      chain?: Partial<EnergyChainInput>;
      dynamics?: Partial<VehicleDynamicsInput>;
    };
    return {
      chain: { ...DEFAULT_ENERGY_CHAIN_INPUT, ...(parsed.chain ?? {}) },
      dynamics: { ...DEFAULT_VEHICLE_DYNAMICS_INPUT, ...(parsed.dynamics ?? {}) },
    };
  } catch {
    return {
      chain: DEFAULT_ENERGY_CHAIN_INPUT,
      dynamics: DEFAULT_VEHICLE_DYNAMICS_INPUT,
    };
  }
}

export default function App() {
  const initialParams = useMemo(() => loadSavedParams(), []);
  const [activeSection, setActiveSection] = useState<AppSection>('simulator');
  const [chainInput, setChainInput] = useState<EnergyChainInput>(initialParams.chain);
  const [dynamicsInput, setDynamicsInput] = useState<VehicleDynamicsInput>(initialParams.dynamics);
  const [calibration, setCalibration] = useState<CalibrationConfig>(() => loadCalibration());
  const [selectedComponent, setSelectedComponent] = useState<ComponentId | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Sync powertrain efficiencies from Energy Chain into Vehicle Dynamics automatically
  const syncedDynamicsInput = useMemo<VehicleDynamicsInput>(
    () => ({
      ...dynamicsInput,
      fuelCellEfficiency: chainInput.fuelCellEfficiency,
      powerElectronicsEfficiency: chainInput.powerElectronicsEfficiency,
      motorEfficiency: chainInput.motorEfficiency,
      drivetrainEfficiency: chainInput.drivetrainEfficiency,
    }),
    [dynamicsInput, chainInput],
  );

  const chainResult = useMemo(() => calculateEnergyChain(chainInput), [chainInput]);
  const dynamicsResult = useMemo(
    () => calculateVehicleDynamics(syncedDynamicsInput),
    [syncedDynamicsInput],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PARAMS_STORAGE_KEY,
        JSON.stringify({ chain: chainInput, dynamics: dynamicsInput }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [chainInput, dynamicsInput]);

  useEffect(() => {
    saveCalibration(calibration);
  }, [calibration]);

  const handleChangeChain = (patch: Partial<EnergyChainInput>) => {
    setChainInput((prev) => ({ ...prev, ...patch }));
  };

  const handleChangeDynamics = (patch: Partial<VehicleDynamicsInput>) => {
    setDynamicsInput((prev) => ({ ...prev, ...patch }));
  };

  const handleResetAll = () => {
    setChainInput(DEFAULT_ENERGY_CHAIN_INPUT);
    setDynamicsInput(DEFAULT_VEHICLE_DYNAMICS_INPUT);
    const defaultCalib = getDefaultCalibration();
    setCalibration(defaultCalib);
    saveCalibration(defaultCalib);
    setSelectedComponent(null);
    setTourActive(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070B12] text-slate-100">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onResetAll={handleResetAll}
      />
      <MobileNavStrip
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      <main className="flex-1">
        {activeSection === 'simulator' && (
          <SimulatorViewport
            chainResult={chainResult}
            dynamicsInput={syncedDynamicsInput}
            dynamicsResult={dynamicsResult}
            onChangeDynamics={handleChangeDynamics}
            calibration={calibration}
            onChangeCalibration={setCalibration}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponent}
            tourActive={tourActive}
            onSetTourActive={setTourActive}
            onOpenHelp={() => setHelpOpen(true)}
          />
        )}

        {activeSection === 'energy' && (
          <EnergyElectrolysisView
            chainInput={chainInput}
            chainResult={chainResult}
            onChangeChainInput={handleChangeChain}
          />
        )}

        {activeSection === 'performance' && (
          <VehiclePerformanceView
            dynamicsInput={syncedDynamicsInput}
            dynamicsResult={dynamicsResult}
            onChangeDynamics={handleChangeDynamics}
          />
        )}

        {activeSection === 'lab' && <VirtualLabView />}

        {activeSection === 'learn' && <CompareLearnView chainInput={chainInput} />}
      </main>

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setActiveSection('simulator');
          setTourActive(true);
          setSelectedComponent('h2_tank');
        }}
      />
    </div>
  );
}
