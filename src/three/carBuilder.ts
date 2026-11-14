import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ForwardAxisOption, normalizeImportedVehicleRoot } from './calibration';

export type VehicleSourceKind = 'procedural_fcev' | 'public_car_glb' | 'custom_glb';

export interface LoadedVehicle {
  wrapperGroup: THREE.Group;
  sourceKind: VehicleSourceKind;
  hasSeparableWheels: boolean;
  wheelRadiusMeters: number;
  wheels: THREE.Object3D[];
  bodyMeshes: THREE.Mesh[];
  glassMeshes: THREE.Mesh[];
  applyBodyAppearance: (opacity: number, visible: boolean) => void;
  setForwardAxis: (axis: ForwardAxisOption) => void;
  dispose: () => void;
}

interface OriginalMaterialState {
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  side: THREE.Side;
}

function buildProceduralFcevSedan(): {
  model: THREE.Group;
  wheels: THREE.Object3D[];
  bodyMeshes: THREE.Mesh[];
  glassMeshes: THREE.Mesh[];
  disposables: Array<{ dispose: () => void }>;
} {
  const model = new THREE.Group();
  model.name = 'ProceduralFCEVSedan';
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // Sculpted fastback aerodynamic silhouette (side profile extruded along X, then centered)
  // Coordinates in side view: X = Z (front +2.30 to rear -2.30), Y = height above ground
  const profile = new THREE.Shape();
  profile.moveTo(-2.16, 0.34);
  profile.lineTo(-2.22, 0.58);
  profile.lineTo(-2.12, 0.96);
  profile.quadraticCurveTo(-1.82, 1.06, -1.34, 1.16);
  profile.quadraticCurveTo(-0.55, 1.46, 0.08, 1.44);
  profile.quadraticCurveTo(0.68, 1.38, 1.04, 1.04);
  profile.quadraticCurveTo(1.75, 0.96, 2.22, 0.72);
  profile.quadraticCurveTo(2.30, 0.52, 2.20, 0.30);
  profile.lineTo(1.88, 0.24);
  profile.lineTo(-1.90, 0.24);
  profile.closePath();

  const bodyGeo = track(
    new THREE.ExtrudeGeometry(profile, {
      depth: 1.66,
      bevelEnabled: true,
      bevelThickness: 0.10,
      bevelSize: 0.08,
      bevelSegments: 4,
      curveSegments: 20,
    }),
  );
  // Rotate so profile X -> +Z (forward), extrusion depth -> X (width)
  bodyGeo.rotateY(-Math.PI / 2);
  bodyGeo.translate(0.83, 0, 0);
  bodyGeo.computeVertexNormals();

  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
    }),
  );
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.renderOrder = 2;
  model.add(bodyMesh);

  // Sculpted upper cabin greenhouse canopy
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.30, 1.08);
  cabinShape.quadraticCurveTo(-0.55, 1.43, 0.05, 1.41);
  cabinShape.quadraticCurveTo(0.60, 1.36, 0.98, 1.02);
  cabinShape.lineTo(-1.30, 1.08);

  const cabinGeo = track(
    new THREE.ExtrudeGeometry(cabinShape, {
      depth: 1.32,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 16,
    }),
  );
  cabinGeo.rotateY(-Math.PI / 2);
  cabinGeo.translate(0.66, 0, 0);
  cabinGeo.computeVertexNormals();

  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.renderOrder = 3;
  model.add(cabinMesh);

  // Accent aerodynamic trim: rocker skirts, front intake fascia, rear diffuser
  const trimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.65,
    }),
  );
  const skirtGeo = track(new THREE.BoxGeometry(1.82, 0.09, 2.25));
  const skirt = new THREE.Mesh(skirtGeo, trimMat);
  skirt.position.set(0, 0.25, 0.03);
  model.add(skirt);

  const grilleGeo = track(new THREE.BoxGeometry(1.26, 0.16, 0.08));
  const grilleMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x082f49,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.22,
      metalness: 0.6,
      roughness: 0.3,
    }),
  );
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.position.set(0, 0.42, 2.26);
  model.add(grille);

  // LED Headlight & Taillight strips
  const headlightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    }),
  );
  const headlightGeo = track(new THREE.BoxGeometry(0.36, 0.05, 0.06));
  [-0.62, 0.62].forEach((x) => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(x, 0.64, 2.22);
    model.add(hl);
  });

  const taillightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      emissive: 0xef4444,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    }),
  );
  const taillight = new THREE.Mesh(track(new THREE.BoxGeometry(1.48, 0.05, 0.05)), taillightMat);
  taillight.position.set(0, 0.88, -2.18);
  model.add(taillight);

  // Side wing mirrors
  const mirrorGeo = track(new THREE.BoxGeometry(0.16, 0.08, 0.12));
  [-0.92, 0.92].forEach((x) => {
    const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
    mirror.position.set(x, 0.98, 0.66);
    model.add(mirror);
  });

  // 4 Separable Wheels (Tire + Multi-spoke Alloy Rim + Brake Rotor)
  const tireMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.86,
      metalness: 0.06,
    }),
  );
  const rimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.9,
      roughness: 0.22,
    }),
  );
  const caliperMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.45,
      roughness: 0.35,
    }),
  );

  const tireGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 18));
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = track(new THREE.BoxGeometry(0.26, 0.38, 0.045));
  const hubGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 0.27, 12));
  hubGeo.rotateZ(Math.PI / 2);

  const wheels: THREE.Object3D[] = [];
  const wheelCoords: Array<[number, number, number]> = [
    [-0.86, 0.34, 1.42],
    [0.86, 0.34, 1.42],
    [-0.86, 0.34, -1.36],
    [0.86, 0.34, -1.36],
  ];

  wheelCoords.forEach(([x, y, z]) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(x, y, z);

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    tire.receiveShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    const hub = new THREE.Mesh(hubGeo, caliperMat);
    wheelGroup.add(tire, rim, hub);

    // 5 radial spokes so wheel rotation is clearly visible!
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.x = (s * Math.PI) / 5;
      wheelGroup.add(spoke);
    }

    model.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  const bodyMeshes: THREE.Mesh[] = [bodyMesh, skirt, grille];
  const glassMeshes: THREE.Mesh[] = [cabinMesh];

  return { model, wheels, bodyMeshes, glassMeshes, disposables };
}

function wrapLoadedModel(
  model: THREE.Object3D,
  sourceKind: VehicleSourceKind,
  forwardAxis: ForwardAxisOption,
  wheelsOverride?: THREE.Object3D[],
  bodyMeshesOverride?: THREE.Mesh[],
  glassMeshesOverride?: THREE.Mesh[],
  extraDisposables: Array<{ dispose: () => void }> = [],
): LoadedVehicle {
  const wrapperGroup = new THREE.Group();
  wrapperGroup.name = 'VehicleBodyWrapper';
  wrapperGroup.add(model);

  normalizeImportedVehicleRoot(model, forwardAxis, 4.6);

  const wheels: THREE.Object3D[] = wheelsOverride ? [...wheelsOverride] : [];
  const bodyMeshes: THREE.Mesh[] = bodyMeshesOverride ? [...bodyMeshesOverride] : [];
  const glassMeshes: THREE.Mesh[] = glassMeshesOverride ? [...glassMeshesOverride] : [];

  const originalStates = new Map<THREE.Material, OriginalMaterialState>();

  if (!bodyMeshesOverride) {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.renderOrder = 2;

        const name = mesh.name.toLowerCase();
        if (name.includes('wheel') || name.includes('tire') || name.includes('tyre')) {
          wheels.push(mesh);
        } else if (name.includes('glass') || name.includes('window') || name.includes('windshield')) {
          glassMeshes.push(mesh);
        } else {
          bodyMeshes.push(mesh);
        }
      }
    });
  }

  // Record original material settings for reversible cutaway transitions
  [...bodyMeshes, ...glassMeshes].forEach((mesh) => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      if (mat && !originalStates.has(mat)) {
        originalStates.set(mat, {
          transparent: mat.transparent,
          opacity: mat.opacity,
          depthWrite: mat.depthWrite,
          side: mat.side,
        });
      }
    });
  });

  const applyBodyAppearance = (opacity: number, visible: boolean) => {
    bodyMeshes.forEach((mesh) => {
      mesh.visible = visible && opacity > 0.02;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const orig = originalStates.get(mat);
        if (!mat || !orig) return;
        const isCutaway = opacity < 0.96;
        mat.transparent = isCutaway ? true : orig.transparent;
        mat.opacity = isCutaway ? opacity : orig.opacity;
        mat.depthWrite = isCutaway ? false : orig.depthWrite;
        mat.needsUpdate = true;
      });
    });

    glassMeshes.forEach((mesh) => {
      mesh.visible = visible && opacity > 0.02;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const orig = originalStates.get(mat);
        if (!mat || !orig) return;
        mat.transparent = true;
        mat.opacity = Math.min(orig.opacity, Math.max(0.12, opacity * 0.65));
        mat.depthWrite = false;
      });
    });
  };

  const setForwardAxis = (axis: ForwardAxisOption) => {
    normalizeImportedVehicleRoot(model, axis, 4.6);
  };

  return {
    wrapperGroup,
    sourceKind,
    hasSeparableWheels: wheels.length >= 4,
    wheelRadiusMeters: 0.34,
    wheels,
    bodyMeshes,
    glassMeshes,
    applyBodyAppearance,
    setForwardAxis,
    dispose: () => {
      extraDisposables.forEach((d) => d.dispose());
      if (sourceKind !== 'procedural_fcev') {
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat) => mat?.dispose());
          }
        });
      }
    },
  };
}

async function tryFetchValidGlb(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 16) return null;
    const bytes = new Uint8Array(buffer, 0, 4);
    const isGlbMagic = bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46; // 'glTF'
    const firstChar = String.fromCharCode(bytes[0]).trim();
    const isGltfJson = firstChar === '{';
    if (!isGlbMagic && !isGltfJson) {
      // Prevents Vite's SPA HTML fallback from failing inside GLTFLoader
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
}

export async function loadVehicleAsset(
  forwardAxis: ForwardAxisOption,
  customUrl?: string,
): Promise<{ vehicle: LoadedVehicle; message: string }> {
  const loader = new GLTFLoader();

  const targetUrl = customUrl ?? '/car.glb';
  const buffer = await tryFetchValidGlb(targetUrl);

  if (buffer) {
    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        loader.parse(buffer, '', (res) => resolve(res), (err) => reject(err));
      });
      const sourceKind: VehicleSourceKind = customUrl ? 'custom_glb' : 'public_car_glb';
      return {
        vehicle: wrapLoadedModel(gltf.scene, sourceKind, forwardAxis),
        message: customUrl
          ? 'Loaded custom GLB/GLTF vehicle model and normalized bounds.'
          : 'Loaded public/car.glb and normalized vehicle coordinate frame.',
      };
    } catch {
      // Fall through to procedural FCEV
    }
  }

  const proc = buildProceduralFcevSedan();
  return {
    vehicle: wrapLoadedModel(
      proc.model,
      'procedural_fcev',
      forwardAxis,
      proc.wheels,
      proc.bodyMeshes,
      proc.glassMeshes,
      proc.disposables,
    ),
    message:
      'Using built-in sculpted procedural FCEV model (place a GLB at public/car.glb or upload one to swap).',
  };
}
