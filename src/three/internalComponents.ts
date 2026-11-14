import * as THREE from 'three';
import { ComponentId } from './componentCatalog';

export interface BuiltInternalComponents {
  rootGroup: THREE.Group;
  groups: Record<ComponentId, THREE.Group>;
  motorRotor: THREE.Group;
  clickTargets: THREE.Object3D[];
  guideLinesGroup: THREE.Group;
  setHighlightedComponent: (id: ComponentId | null) => void;
  updateExplodedGuides: (explodeAmount: number, getTargetPos: (id: ComponentId) => THREE.Vector3, getBasePos: (id: ComponentId) => THREE.Vector3) => void;
  dispose: () => void;
}

function createPlacardTexture(text: string, subtext: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#09121E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = accent;
    ctx.font = 'bold 46px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, 74);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '26px sans-serif';
    ctx.fillText(subtext, canvas.width / 2, 122);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function tagGroup(group: THREE.Group, componentId: ComponentId): void {
  group.userData.componentId = componentId;
  group.traverse((obj) => {
    obj.userData.componentId = componentId;
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.renderOrder = 5;
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

export function createInternalComponents(maxAnisotropy = 4): BuiltInternalComponents {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'InternalHydrogenSystems';

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Shared PBR materials
  const carbonTankMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      metalness: 0.25,
      roughness: 0.35,
      clearcoat: 0.75,
      clearcoatRoughness: 0.2,
    }),
  );
  const aluminumMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xb8c4d4,
      metalness: 0.85,
      roughness: 0.25,
    }),
  );
  const darkSteelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x263143,
      metalness: 0.75,
      roughness: 0.4,
    }),
  );
  const copperMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.22,
    }),
  );
  const stackPlateMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.55,
      roughness: 0.35,
    }),
  );
  const batteryMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x4c1d95,
      metalness: 0.35,
      roughness: 0.42,
    }),
  );
  const radiatorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.38,
    }),
  );
  const thermalPipeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      metalness: 0.45,
      roughness: 0.35,
    }),
  );
  const hvBusMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.3,
      roughness: 0.35,
    }),
  );

  // 1. Hydrogen Storage Tanks (Twin 700-bar Type-IV cylinders + manifold)
  const h2TankGroup = new THREE.Group();
  h2TankGroup.name = 'h2_tank';

  const tankTex = track(createPlacardTexture('H₂ · 700 BAR', 'TYPE-IV STORAGE', '#22D3EE'));
  tankTex.anisotropy = maxAnisotropy;
  const tankLabelMat = track(
    new THREE.MeshStandardMaterial({
      map: tankTex,
      roughness: 0.4,
      metalness: 0.1,
    }),
  );

  const cylGeo = track(new THREE.CylinderGeometry(0.165, 0.165, 0.92, 24));
  const capGeo = track(new THREE.SphereGeometry(0.165, 20, 14));
  const strapGeo = track(new THREE.TorusGeometry(0.172, 0.014, 10, 24));

  [-0.24, 0.24].forEach((xOffset) => {
    const vessel = new THREE.Group();
    vessel.rotation.z = Math.PI / 2; // Transverse across rear bay

    const body = new THREE.Mesh(cylGeo, carbonTankMat);
    vessel.add(body);

    const capL = new THREE.Mesh(capGeo, aluminumMat);
    capL.position.y = 0.46;
    vessel.add(capL);

    const capR = new THREE.Mesh(capGeo, aluminumMat);
    capR.position.y = -0.46;
    vessel.add(capR);

    [-0.28, 0.28].forEach((sy) => {
      const strap = new THREE.Mesh(strapGeo, darkSteelMat);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = sy;
      vessel.add(strap);
    });

    vessel.position.set(0, 0, xOffset);
    h2TankGroup.add(vessel);
  });

  // Placard & regulator block
  const placard = new THREE.Mesh(track(new THREE.PlaneGeometry(0.46, 0.14)), tankLabelMat);
  placard.rotation.x = -Math.PI / 2;
  placard.position.set(0, 0.175, -0.24);
  h2TankGroup.add(placard);

  const regulator = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.12, 0.28)), aluminumMat);
  regulator.position.set(0.46, 0.06, 0);
  h2TankGroup.add(regulator);

  // 2. PEM Fuel-Cell Stack (22 repeating plates + end compression plates + ports)
  const fuelCellGroup = new THREE.Group();
  fuelCellGroup.name = 'fuel_cell';

  const stackBody = new THREE.Mesh(track(new THREE.BoxGeometry(0.56, 0.30, 0.44)), darkSteelMat);
  fuelCellGroup.add(stackBody);

  const plateGeo = track(new THREE.BoxGeometry(0.58, 0.26, 0.011));
  for (let i = -8; i <= 8; i++) {
    const plate = new THREE.Mesh(plateGeo, i % 2 === 0 ? stackPlateMat : aluminumMat);
    plate.position.z = i * 0.022;
    fuelCellGroup.add(plate);
  }

  const endPlateGeo = track(new THREE.BoxGeometry(0.62, 0.34, 0.032));
  const frontEnd = new THREE.Mesh(endPlateGeo, aluminumMat);
  frontEnd.position.z = 0.22;
  const rearEnd = new THREE.Mesh(endPlateGeo, aluminumMat);
  rearEnd.position.z = -0.22;
  fuelCellGroup.add(frontEnd, rearEnd);

  // Air intake & H2 anode manifolds
  const airIntake = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.055, 0.065, 0.22, 16)),
    track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.35 })),
  );
  airIntake.rotation.x = Math.PI / 2;
  airIntake.position.set(-0.18, 0.1, 0.28);
  fuelCellGroup.add(airIntake);

  const fcPlacardTex = track(createPlacardTexture('PEM STACK', '2H₂ + O₂ → 2H₂O + e⁻', '#10B981'));
  fcPlacardTex.anisotropy = maxAnisotropy;
  const fcPlacard = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.44, 0.13)),
    track(new THREE.MeshStandardMaterial({ map: fcPlacardTex, roughness: 0.4 })),
  );
  fcPlacard.rotation.x = -Math.PI / 2;
  fcPlacard.position.set(0, 0.175, 0);
  fuelCellGroup.add(fcPlacard);

  // 3. Power Electronics (DC/DC + Traction Inverter)
  const powerElectronicsGroup = new THREE.Group();
  powerElectronicsGroup.name = 'power_electronics';

  const peHousing = new THREE.Mesh(track(new THREE.BoxGeometry(0.54, 0.14, 0.42)), aluminumMat);
  powerElectronicsGroup.add(peHousing);

  // Cooling fins on top
  const finGeo = track(new THREE.BoxGeometry(0.48, 0.028, 0.015));
  for (let i = -5; i <= 5; i++) {
    const fin = new THREE.Mesh(finGeo, darkSteelMat);
    fin.position.set(0, 0.08, i * 0.034);
    powerElectronicsGroup.add(fin);
  }
  const hvTerminal = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.08, 0.12)), hvBusMat);
  hvTerminal.position.set(0.24, 0.03, 0.14);
  powerElectronicsGroup.add(hvTerminal);

  // 4. Buffer Battery (HV Li-ion module)
  const bufferBatteryGroup = new THREE.Group();
  bufferBatteryGroup.name = 'buffer_battery';

  const battCase = new THREE.Mesh(track(new THREE.BoxGeometry(0.86, 0.14, 0.56)), darkSteelMat);
  bufferBatteryGroup.add(battCase);
  const cellGeo = track(new THREE.BoxGeometry(0.18, 0.11, 0.48));
  for (let i = -1.5; i <= 1.5; i += 1) {
    const cell = new THREE.Mesh(cellGeo, batteryMat);
    cell.position.set(i * 0.21, 0.03, 0);
    bufferBatteryGroup.add(cell);
  }

  // 5. Electric Traction Motor (Stator + rotating shaft + reduction gearbox)
  const electricMotorGroup = new THREE.Group();
  electricMotorGroup.name = 'electric_motor';

  const stator = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.17, 0.44, 24)), aluminumMat);
  stator.rotation.z = Math.PI / 2;
  electricMotorGroup.add(stator);

  const windingCapGeo = track(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20));
  const cap1 = new THREE.Mesh(windingCapGeo, copperMat);
  cap1.rotation.z = Math.PI / 2;
  cap1.position.x = 0.24;
  const cap2 = new THREE.Mesh(windingCapGeo, copperMat);
  cap2.rotation.z = Math.PI / 2;
  cap2.position.x = -0.24;
  electricMotorGroup.add(cap1, cap2);

  // Rotating rotor shaft indicator
  const motorRotor = new THREE.Group();
  const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.68, 12)), hvBusMat);
  shaft.rotation.z = Math.PI / 2;
  motorRotor.add(shaft);
  const flange = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.16, 0.05)), copperMat);
  flange.position.x = 0.33;
  motorRotor.add(flange);
  electricMotorGroup.add(motorRotor);

  const gearbox = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.22, 0.26)), darkSteelMat);
  gearbox.position.set(-0.34, -0.02, 0);
  electricMotorGroup.add(gearbox);

  // 6. Thermal Management System (Front radiator + coolant pump + red loop)
  const thermalGroup = new THREE.Group();
  thermalGroup.name = 'thermal_system';

  const radCore = new THREE.Mesh(track(new THREE.BoxGeometry(0.96, 0.34, 0.08)), radiatorMat);
  thermalGroup.add(radCore);

  const fanRingGeo = track(new THREE.TorusGeometry(0.13, 0.02, 8, 24));
  [-0.24, 0.24].forEach((x) => {
    const fan = new THREE.Mesh(fanRingGeo, darkSteelMat);
    fan.position.set(x, 0, -0.045);
    thermalGroup.add(fan);
  });

  const coolantTube = new THREE.Mesh(
    track(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.38, 0.1, -0.04),
          new THREE.Vector3(-0.38, 0.15, -0.55),
          new THREE.Vector3(0.38, 0.15, -0.55),
          new THREE.Vector3(0.38, -0.1, -0.04),
        ]),
        24,
        0.02,
        8,
        false,
      ),
    ),
    thermalPipeMat,
  );
  thermalGroup.add(coolantTube);

  // 7. Drivetrain / Structural Subframe & Axles
  const drivetrainGroup = new THREE.Group();
  drivetrainGroup.name = 'drivetrain';

  const railGeo = track(new THREE.BoxGeometry(0.08, 0.08, 3.15));
  [-0.56, 0.56].forEach((x) => {
    const rail = new THREE.Mesh(railGeo, darkSteelMat);
    rail.position.set(x, -0.06, 0.04);
    drivetrainGroup.add(rail);
  });
  const axleGeo = track(new THREE.CylinderGeometry(0.032, 0.032, 1.56, 12));
  const frontAxle = new THREE.Mesh(axleGeo, aluminumMat);
  frontAxle.rotation.z = Math.PI / 2;
  frontAxle.position.set(0, 0, 1.42);
  const rearAxle = new THREE.Mesh(axleGeo, aluminumMat);
  rearAxle.rotation.z = Math.PI / 2;
  rearAxle.position.set(0, 0, -1.36);
  drivetrainGroup.add(frontAxle, rearAxle);

  const groups: Record<ComponentId, THREE.Group> = {
    h2_tank: h2TankGroup,
    fuel_cell: fuelCellGroup,
    power_electronics: powerElectronicsGroup,
    buffer_battery: bufferBatteryGroup,
    electric_motor: electricMotorGroup,
    thermal_system: thermalGroup,
    drivetrain: drivetrainGroup,
  };

  const clickTargets: THREE.Object3D[] = [];
  (Object.keys(groups) as ComponentId[]).forEach((id) => {
    const g = groups[id];
    tagGroup(g, id);
    rootGroup.add(g);
    clickTargets.push(g);
  });

  // Guide lines for Exploded View
  const guideLinesGroup = new THREE.Group();
  guideLinesGroup.name = 'ExplodedGuideLines';
  const guideMat = track(
    new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.08,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.7,
    }),
  );
  const guideLines = new Map<ComponentId, THREE.Line>();
  (Object.keys(groups) as ComponentId[]).forEach((id) => {
    const geo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const line = new THREE.Line(geo, guideMat);
    line.computeLineDistances();
    guideLines.set(id, line);
    guideLinesGroup.add(line);
  });
  guideLinesGroup.visible = false;
  rootGroup.add(guideLinesGroup);

  // Selection highlight via emissive tinting on cloned/tagged materials
  const meshBaseEmissive = new Map<THREE.Mesh, { color: number; intensity: number }>();
  rootGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m.material && !Array.isArray(m.material)) {
        // Clone per-component materials lazily if shared across components
        m.material = m.material.clone();
        track(m.material);
        const std = m.material as THREE.MeshStandardMaterial;
        if (std.emissive) {
          meshBaseEmissive.set(m, {
            color: std.emissive.getHex(),
            intensity: std.emissiveIntensity ?? 1,
          });
        }
      }
    }
  });

  const setHighlightedComponent = (id: ComponentId | null) => {
    (Object.keys(groups) as ComponentId[]).forEach((compId) => {
      const active = id === compId;
      groups[compId].traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          const std = m.material as THREE.MeshStandardMaterial;
          const base = meshBaseEmissive.get(m);
          if (std && std.emissive && base) {
            if (active) {
              std.emissive.setHex(0x22d3ee);
              std.emissiveIntensity = 0.55;
            } else {
              std.emissive.setHex(base.color);
              std.emissiveIntensity = base.intensity;
            }
          }
        }
      });
    });
  };

  const updateExplodedGuides = (
    explodeAmount: number,
    getTargetPos: (id: ComponentId) => THREE.Vector3,
    getBasePos: (id: ComponentId) => THREE.Vector3,
  ) => {
    guideLinesGroup.visible = explodeAmount > 0.03;
    if (!guideLinesGroup.visible) return;
    guideLines.forEach((line, id) => {
      const base = getBasePos(id);
      const curr = getTargetPos(id);
      const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, base.x, base.y, base.z);
      posAttr.setXYZ(1, curr.x, curr.y, curr.z);
      posAttr.needsUpdate = true;
      line.computeLineDistances();
    });
  };

  return {
    rootGroup,
    groups,
    motorRotor,
    clickTargets,
    guideLinesGroup,
    setHighlightedComponent,
    updateExplodedGuides,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
