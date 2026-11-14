# HYDRODRIVE 3D — Interactive Hydrogen Fuel-Cell Vehicle Engineering Simulator

HYDRODRIVE 3D is an interactive 3D digital twin, physics calculator, and virtual laboratory built for first-year engineering physics demonstrations of Hydrogen Fuel-Cell Electric Vehicles (FCEVs).

## 1. Quick Start (Local Development)

1. **Install Node.js** (v18+ recommended).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.
4. **Run physics unit tests**:
   ```bash
   npx --yes tsx --test src/physics/physics.test.ts
   ```
5. **Production build check**:
   ```bash
   npm run build
   ```

## 2. Project File Guide (For Beginners)

- **`index.html` & `src/index.css`**: Loads typography (`Plus Jakarta Sans`, `IBM Plex Sans`, `JetBrains Mono`) and Tailwind CSS styling.
- **`src/App.tsx`**: Main application shell linking the 5 workspaces and saving parameters in `localStorage`.
- **`src/physics/`** (Pure engineering math, independent of 3D rendering):
  - `electrolysis.ts`: Off-board water electrolysis ($2\text{H}_2\text{O} \to 2\text{H}_2 + \text{O}_2$) using Hydrogen LHV = `33.33 kWh/kg`.
  - `energyChain.ts`: Multi-stage energy conversion accounting (`E_input` $\to$ Electrolyzer $\to$ Conditioning $\to$ Fuel Cell $\to$ Power Electronics $\to$ Motor $\to$ Drivetrain) without double-counting losses.
  - `vehicleDynamics.ts`: Longitudinal tractive force ($F_{\text{drag}} + F_{\text{roll}} + F_{\text{grade}} + F_{\text{accel}}$), wheel/electrical/chemical power (kW), consumption (`kg/100 km`), and range (`km`).
  - `comparison.ts`: Side-by-side FCEV vs. BEV comparison starting from the exact same input electricity boundary.
  - `experiments.ts`: Five structured Virtual Physics Laboratory experiments (Experiments A–E) + CSV export formatting.
  - `physics.test.ts`: Automated `node:test` verification suite for conservation laws and physics bounds.
- **`src/three/`** (3D WebGL engine):
  - `sceneManager.ts`: Sets up the Three.js scene, studio `RoomEnvironment` reflections, lighting, camera presets, 3-axis object rotation, raycasting, and software-WebGL performance guard.
  - `carBuilder.ts`: Loads `public/car.glb` (or a user-uploaded `.glb`/`.gltf` file), normalizes bounding box & ground contact, and includes a sculpted multi-part procedural FCEV fallback if `public/car.glb` is not present.
  - `internalComponents.ts`: Procedural 3D assemblies for the 700-bar H₂ tanks, 22-plate PEM fuel-cell stack, power electronics, buffer battery, electric traction motor, radiator/thermal loop, and drivetrain.
  - `calibration.ts`: Consistent vehicle coordinate normalization and `localStorage` persistence for component position/rotation/scale and forward-axis orientation.
  - `energyFlowParticles.ts`: Instanced animated particle conduits for hydrogen, air/oxygen, electrical power, water exhaust, and heat rejection.
  - `roadEnvironment.ts`: Studio floor grid, contact shadow, and scrolling road animation for Driving Mode.
- **`src/components/`**: Modular React UI views (`SimulatorViewport.tsx`, `EnergyElectrolysisView.tsx`, `VehiclePerformanceView.tsx`, `VirtualLabView.tsx`, `CompareLearnView.tsx`, `Charts.tsx`, `TopBar.tsx`, `HelpModal.tsx`).

## 3. How to Replace `public/car.glb`

1. Place your legally licensed `.glb` vehicle file at `public/car.glb` and refresh the page — HYDRODRIVE 3D detects the binary `glTF` header automatically.
2. Alternatively, click **Load .glb** in the 3D Simulator top-left toolbar to preview any local `.glb` or `.gltf` file immediately without restarting the server.
3. If your model faces a different axis, open the **Calibration** tab in the bottom dock and choose the matching **Forward Axis** (`+Z`, `-Z`, `+X`, or `-X`). Your offsets save automatically to `localStorage`.

## 4. How to Present This to a Physics Professor

1. Start in **3D Simulator** in **Cutaway** mode and click **Guided Tour** to walk through the 700-bar H₂ tank, PEM stack, power electronics, buffer battery, traction motor, and radiator.
2. Switch to **Energy Flow** mode (and **Step-by-Step**) to trace how chemical energy becomes electrical and mechanical work, highlighting water exhaust and thermal heat rejection.
3. Open **Energy Chain** to show the distinction between **Tank-to-Wheels** efficiency and **Electricity-to-Wheels** efficiency on a consistent **33.33 kWh/kg LHV** basis.
4. Open **Performance** to demonstrate $v^2$ aerodynamic drag force ($v^3$ power scaling) and capped regenerative braking.
5. Open **Physics Lab**, run a parameter sweep in **Experiment D** or **Experiment A**, and export the CSV dataset.
