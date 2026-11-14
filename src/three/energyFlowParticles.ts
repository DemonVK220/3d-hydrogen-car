import * as THREE from 'three';

export interface FlowAnimationState {
  playing: boolean;
  speedMultiplier: number;
  mode: 'continuous' | 'step_by_step' | 'slow_motion';
  activeStepIndex: number; // 0..4 for step-by-step highlight
}

interface FlowPathSpec {
  id: string;
  stepIndex: number;
  color: number;
  count: number;
  curve: THREE.CatmullRomCurve3;
  speedFactor: number;
  radius: number;
}

export interface EnergyFlowSystem {
  group: THREE.Group;
  update: (dt: number, powerDemandFraction: number, isRegenerating: boolean, state: FlowAnimationState) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

export function createEnergyFlowSystem(): EnergyFlowSystem {
  const group = new THREE.Group();
  group.name = 'EnergyFlowParticles';
  group.visible = false;

  const specs: FlowPathSpec[] = [
    {
      // Step 0: Hydrogen Gas (Cyan): Tank (-1.24) -> Regulator -> Fuel Cell (+1.05)
      id: 'h2_gas',
      stepIndex: 0,
      color: 0x06b6d4,
      count: 14,
      speedFactor: 0.45,
      radius: 0.028,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.28, 0.48, -1.10),
        new THREE.Vector3(0.45, 0.50, -0.55),
        new THREE.Vector3(0.42, 0.56, 0.25),
        new THREE.Vector3(0.24, 0.60, 0.92),
      ]),
    },
    {
      // Step 1: Oxygen / Air Supply (Pale Sky Blue): Front Grille (+1.90) -> Fuel Cell Cathode (+1.05)
      id: 'o2_air',
      stepIndex: 1,
      color: 0x7dd3fc,
      count: 10,
      speedFactor: 0.55,
      radius: 0.025,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, 0.46, 1.98),
        new THREE.Vector3(-0.20, 0.62, 1.56),
        new THREE.Vector3(-0.18, 0.68, 1.18),
      ]),
    },
    {
      // Step 2: Electrical Energy (Amber): Fuel Cell (+1.05) -> Power Electronics (+0.56) -> Electric Motor (+1.38)
      id: 'electric_dc',
      stepIndex: 2,
      color: 0xf59e0b,
      count: 16,
      speedFactor: 0.72,
      radius: 0.028,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.18, 0.72, 0.95),
        new THREE.Vector3(0.20, 0.84, 0.62),
        new THREE.Vector3(-0.14, 0.78, 0.62),
        new THREE.Vector3(-0.16, 0.55, 1.05),
        new THREE.Vector3(-0.12, 0.42, 1.38),
      ]),
    },
    {
      // Step 2b: Buffer Battery <-> Power Electronics branch
      id: 'battery_bus',
      stepIndex: 2,
      color: 0xc084fc,
      count: 8,
      speedFactor: 0.52,
      radius: 0.024,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.28, 0.36, -0.25),
        new THREE.Vector3(-0.28, 0.58, 0.15),
        new THREE.Vector3(-0.18, 0.76, 0.50),
      ]),
    },
    {
      // Step 3: Water Production (Blue droplets): Fuel Cell -> Underbody exhaust
      id: 'water_out',
      stepIndex: 3,
      color: 0x3b82f6,
      count: 10,
      speedFactor: 0.40,
      radius: 0.024,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.18, 0.54, 0.95),
        new THREE.Vector3(-0.22, 0.28, 0.55),
        new THREE.Vector3(-0.20, 0.18, -0.60),
        new THREE.Vector3(-0.20, 0.16, -2.05),
      ]),
    },
    {
      // Step 4: Heat Rejection (Coral Red): Fuel Cell -> Front Radiator
      id: 'heat_loss',
      stepIndex: 4,
      color: 0xf43f5e,
      count: 10,
      speedFactor: 0.45,
      radius: 0.023,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.32, 0.64, 1.15),
        new THREE.Vector3(0.36, 0.58, 1.48),
        new THREE.Vector3(0.28, 0.48, 1.78),
        new THREE.Vector3(-0.28, 0.48, 1.78),
      ]),
    },
  ];

  const disposables: Array<{ dispose: () => void }> = [];
  const sphereGeo = new THREE.SphereGeometry(1, 10, 10);
  disposables.push(sphereGeo);

  const entries: Array<{
    spec: FlowPathSpec;
    instanced: THREE.InstancedMesh;
    tubeMesh: THREE.Mesh;
    phase: number;
  }> = [];

  const dummy = new THREE.Object3D();
  const posScratch = new THREE.Vector3();

  specs.forEach((spec) => {
    // Translucent conduit tube
    const tubeGeo = new THREE.TubeGeometry(spec.curve, 32, 0.011, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0.35,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.renderOrder = 6;
    group.add(tubeMesh);
    disposables.push(tubeGeo, tubeMat);

    // Instanced moving particles
    const partMat = new THREE.MeshBasicMaterial({ color: spec.color });
    const instanced = new THREE.InstancedMesh(sphereGeo, partMat, spec.count);
    instanced.frustumCulled = false;
    instanced.renderOrder = 7;
    for (let i = 0; i < spec.count; i++) {
      spec.curve.getPointAt(i / spec.count, posScratch);
      dummy.position.copy(posScratch);
      dummy.scale.setScalar(spec.radius);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
    disposables.push(partMat);

    entries.push({ spec, instanced, tubeMesh, phase: 0 });
  });

  const update = (
    dt: number,
    powerDemandFraction: number,
    isRegenerating: boolean,
    state: FlowAnimationState,
  ) => {
    const modeRate = state.mode === 'slow_motion' ? 0.32 : 1.0;
    const effectiveSpeed = state.playing
      ? state.speedMultiplier * modeRate * (0.45 + 1.2 * Math.min(1.5, Math.max(0.1, powerDemandFraction)))
      : 0;

    entries.forEach((entry) => {
      const { spec, instanced, tubeMesh } = entry;
      const stepActive =
        state.mode !== 'step_by_step' || spec.stepIndex === state.activeStepIndex;

      instanced.visible = group.visible && stepActive;
      (tubeMesh.material as THREE.MeshBasicMaterial).opacity = stepActive ? 0.42 : 0.08;

      if (!instanced.visible) return;

      // Reverse battery branch direction during regenerative braking
      const direction = spec.id === 'battery_bus' && isRegenerating ? 1 : -1;
      entry.phase = (entry.phase + dt * spec.speedFactor * effectiveSpeed * (spec.id === 'battery_bus' ? -direction : 1)) % 1;
      if (entry.phase < 0) entry.phase += 1;

      for (let i = 0; i < spec.count; i++) {
        const t = (entry.phase + i / spec.count) % 1;
        spec.curve.getPointAt(t, posScratch);
        dummy.position.copy(posScratch);
        dummy.scale.setScalar(spec.radius);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
    });
  };

  return {
    group,
    update,
    setVisible: (visible: boolean) => {
      group.visible = visible;
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
