export type ComponentId =
  | 'h2_tank'
  | 'fuel_cell'
  | 'power_electronics'
  | 'electric_motor'
  | 'buffer_battery'
  | 'thermal_system'
  | 'drivetrain';

export interface ComponentMetadata {
  id: ComponentId;
  name: string;
  shortName: string;
  systemRole: string;
  colorHex: string;
  inputForm: string;
  outputForm: string;
  typicalEfficiencyLabel: string;
  summary: string;
  detailedPhysics: string;
  cameraOffset: [number, number, number];
  defaultLocalPos: [number, number, number]; // Normalized car space (car length ~4.6m, +Z forward)
  explodedOffset: [number, number, number];
}

export const COMPONENT_ORDER: ComponentId[] = [
  'h2_tank',
  'fuel_cell',
  'power_electronics',
  'buffer_battery',
  'electric_motor',
  'thermal_system',
  'drivetrain',
];

export const COMPONENT_CATALOG: Record<ComponentId, ComponentMetadata> = {
  h2_tank: {
    id: 'h2_tank',
    name: '700-bar Hydrogen Storage Tanks',
    shortName: 'H₂ Tank',
    systemRole: 'Chemical Energy Storage',
    colorHex: '#06B6D4',
    inputForm: 'Compressed H₂ Gas (700 bar)',
    outputForm: 'Regulated H₂ Flow (8–15 bar to stack)',
    typicalEfficiencyLabel: '~88% well-to-tank conditioning retention',
    summary:
      'Stores compressed gaseous hydrogen at 70 MPa (700 bar) inside carbon-fiber-reinforced Type-IV pressure vessels.',
    detailedPhysics:
      'Hydrogen has high gravimetric energy density (33.33 kWh/kg LHV) but low volumetric density at atmospheric pressure. Compressing H₂ to 700 bar increases density to ~42 kg/m³. A pressure regulator steps tank pressure down before feeding the fuel-cell anode. Note: Tank stores chemical energy supplied by external production; the car does not generate H₂ on board.',
    cameraOffset: [-2.2, 1.35, -2.4],
    defaultLocalPos: [0, 0.44, -1.24],
    explodedOffset: [0, 0.95, -1.35],
  },
  fuel_cell: {
    id: 'fuel_cell',
    name: 'PEM Fuel-Cell Stack',
    shortName: 'Fuel Cell',
    systemRole: 'Electrochemical Conversion',
    colorHex: '#10B981',
    inputForm: 'H₂ (anode) + O₂ from air (cathode)',
    outputForm: 'DC Electricity + H₂O (water) + Heat',
    typicalEfficiencyLabel: '45%–62% (LHV basis)',
    summary:
      'Converts hydrogen chemical energy directly into DC electricity via an electrochemical reaction: 2H₂ + O₂ → 2H₂O + energy.',
    detailedPhysics:
      'At the anode catalyst, H₂ splits into protons (H⁺) and electrons (e⁻). The polymer electrolyte membrane conducts only protons to the cathode, forcing electrons through the external vehicle circuit as useful DC current. At the cathode, protons, electrons, and atmospheric oxygen combine to form water vapor and heat. Because it is electrochemical rather than combustion, it is not Carnot-limited, though activation, ohmic, and mass-transport overpotentials cause ~40–50% heat loss.',
    cameraOffset: [2.1, 1.4, 2.0],
    defaultLocalPos: [0, 0.62, 1.05],
    explodedOffset: [0, 1.38, 0.45],
  },
  power_electronics: {
    id: 'power_electronics',
    name: 'Power Electronics (DC/DC & Inverter)',
    shortName: 'Power Electronics',
    systemRole: 'Voltage Conditioning & Motor Drive',
    colorHex: '#FBBF24',
    inputForm: 'Variable Stack DC + Buffer Battery DC',
    outputForm: '3-Phase Variable-Frequency AC',
    typicalEfficiencyLabel: '94%–97%',
    summary:
      'Boosts variable fuel-cell voltage to a high-voltage DC bus and inverts DC into 3-phase AC to control motor torque and speed.',
    detailedPhysics:
      'Fuel-cell stack voltage drops as current draw rises (polarization curve). A bidirectional boost DC/DC converter stabilizes the high-voltage bus (typically 400–800 V), blends power with the buffer battery, and feeds a silicon-carbide/IGBT traction inverter. Switching and conduction losses dissipate ~3–6% of electrical energy as heat.',
    cameraOffset: [1.8, 1.45, 1.2],
    defaultLocalPos: [0, 0.80, 0.56],
    explodedOffset: [1.22, 1.32, 0.15],
  },
  buffer_battery: {
    id: 'buffer_battery',
    name: 'High-Voltage Buffer Battery',
    shortName: 'Buffer Battery',
    systemRole: 'Transient Power & Regen Capture',
    colorHex: '#A855F7',
    inputForm: 'Regenerative Braking & Surplus Stack DC',
    outputForm: 'Peak Acceleration Assist DC',
    typicalEfficiencyLabel: '~90% round-trip',
    summary:
      'A compact (~1.5–2 kWh) lithium-ion pack that absorbs regenerative braking energy and covers rapid acceleration transients.',
    detailedPhysics:
      'Fuel cells respond smoothly to steady power demands but benefit from avoiding rapid load spikes. The buffer battery supplies instantaneous torque bursts during hard acceleration and captures kinetic energy during regenerative braking (capped by motor/battery charge power limits — never 100% recovery).',
    cameraOffset: [-2.0, 1.25, -0.35],
    defaultLocalPos: [0, 0.30, -0.32],
    explodedOffset: [-1.28, 0.72, -0.15],
  },
  electric_motor: {
    id: 'electric_motor',
    name: 'Electric Traction Motor',
    shortName: 'Electric Motor',
    systemRole: 'Electromechanical Conversion',
    colorHex: '#F59E0B',
    inputForm: '3-Phase AC Electrical Power',
    outputForm: 'Mechanical Shaft Torque & Rotation',
    typicalEfficiencyLabel: '88%–95%',
    summary:
      'Converts electrical energy into rotational mechanical work via interacting magnetic fields in the stator and permanent-magnet rotor.',
    detailedPhysics:
      'Three-phase AC currents in the stationary stator windings generate a rotating magnetic field that exerts Lorentz/magnetic torque on the rotor. During deceleration, the motor operates in reverse as a generator to slow the vehicle and feed electrical energy back through the inverter to the buffer battery.',
    cameraOffset: [1.9, 1.1, 2.3],
    defaultLocalPos: [0, 0.36, 1.38],
    explodedOffset: [-0.95, 0.18, 1.35],
  },
  thermal_system: {
    id: 'thermal_system',
    name: 'Thermal Management & Radiator',
    shortName: 'Thermal System',
    systemRole: 'Low-Grade Heat Rejection',
    colorHex: '#F43F5E',
    inputForm: 'Stack & Inverter Waste Heat (~65–80 °C)',
    outputForm: 'Heat Rejected to Ambient Air',
    typicalEfficiencyLabel: 'Illustrative cooling loop',
    summary:
      'Circulates deionized coolant to maintain the PEM fuel cell near ~70–80 °C and reject low-grade waste heat through the front radiator.',
    detailedPhysics:
      'Unlike an internal combustion engine that rejects much of its waste heat out a hot exhaust pipe, a PEM fuel cell operates at ~65–80 °C and rejects nearly all waste heat into its liquid coolant loop. This requires a high-airflow front radiator and cooling fans (an auxiliary parasitic load omitted from simplified stage-efficiency equations).',
    cameraOffset: [1.6, 1.25, 3.0],
    defaultLocalPos: [0, 0.48, 1.78],
    explodedOffset: [0, 0.35, 1.68],
  },
  drivetrain: {
    id: 'drivetrain',
    name: 'Reduction Gearbox, Axles & Wheels',
    shortName: 'Drivetrain',
    systemRole: 'Mechanical Power Delivery',
    colorHex: '#FB923C',
    inputForm: 'Motor Shaft Torque',
    outputForm: 'Wheel Tractive Force (F_total × v)',
    typicalEfficiencyLabel: '93%–97%',
    summary:
      'Transfers motor torque through a single-speed helical reduction gearbox, differential, half-shafts, and tires to propel the vehicle.',
    detailedPhysics:
      'Electric motors deliver high torque across a wide RPM range, eliminating multi-speed transmissions. A single-speed reduction gear multiplies torque to the driven axle. Mechanical bearing friction, gear meshing, and tire contact losses represent the final stage before overcoming aerodynamic drag, rolling resistance, and road grade.',
    cameraOffset: [-2.8, 1.25, 1.8],
    defaultLocalPos: [0, 0.34, 0],
    explodedOffset: [0, -0.18, 0],
  },
};
