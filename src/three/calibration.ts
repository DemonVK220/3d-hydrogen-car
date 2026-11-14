import * as THREE from 'three';
import { COMPONENT_CATALOG, COMPONENT_ORDER, ComponentId } from './componentCatalog';

export type ForwardAxisOption = 'posZ' | 'negZ' | 'posX' | 'negX';

export interface ComponentTransformOverride {
  x: number;
  y: number;
  z: number;
  rx: number; // degrees
  ry: number; // degrees
  rz: number; // degrees
  scale: number;
}

export interface CalibrationConfig {
  forwardAxis: ForwardAxisOption;
  components: Record<ComponentId, ComponentTransformOverride>;
}

const STORAGE_KEY = 'hydrodrive3d.calibration.v1';

export function getDefaultCalibration(): CalibrationConfig {
  const components = {} as Record<ComponentId, ComponentTransformOverride>;
  for (const id of COMPONENT_ORDER) {
    const [x, y, z] = COMPONENT_CATALOG[id].defaultLocalPos;
    components[id] = { x, y, z, rx: 0, ry: 0, rz: 0, scale: 1 };
  }
  return {
    forwardAxis: 'posZ',
    components,
  };
}

export function loadCalibration(): CalibrationConfig {
  const defaults = getDefaultCalibration();
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaults;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<CalibrationConfig>;
    const forwardAxis: ForwardAxisOption =
      parsed.forwardAxis === 'posZ' ||
      parsed.forwardAxis === 'negZ' ||
      parsed.forwardAxis === 'posX' ||
      parsed.forwardAxis === 'negX'
        ? parsed.forwardAxis
        : defaults.forwardAxis;

    const components = { ...defaults.components };
    if (parsed.components) {
      for (const id of COMPONENT_ORDER) {
        const entry = parsed.components[id];
        if (entry && typeof entry.x === 'number') {
          components[id] = {
            x: Number.isFinite(entry.x) ? entry.x : defaults.components[id].x,
            y: Number.isFinite(entry.y) ? entry.y : defaults.components[id].y,
            z: Number.isFinite(entry.z) ? entry.z : defaults.components[id].z,
            rx: Number.isFinite(entry.rx) ? entry.rx : 0,
            ry: Number.isFinite(entry.ry) ? entry.ry : 0,
            rz: Number.isFinite(entry.rz) ? entry.rz : 0,
            scale: Number.isFinite(entry.scale) ? Math.max(0.3, Math.min(2.5, entry.scale)) : 1,
          };
        }
      }
    }
    return { forwardAxis, components };
  } catch {
    return defaults;
  }
}

export function saveCalibration(config: CalibrationConfig): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function getForwardAxisRotationY(axis: ForwardAxisOption): number {
  switch (axis) {
    case 'posZ':
      return 0;
    case 'negZ':
      return Math.PI;
    case 'posX':
      return -Math.PI / 2;
    case 'negX':
      return Math.PI / 2;
  }
}

/**
 * Normalizes any imported GLTF/GLB vehicle root so that:
 * 1) Its selected forward axis aligns with +Z
 * 2) Its overall length along Z is normalized to targetLengthMeters (4.60 m)
 * 3) Its horizontal center is at X=0, Z=0 and lowest point rests cleanly on Y=0
 */
export function normalizeImportedVehicleRoot(
  model: THREE.Object3D,
  forwardAxis: ForwardAxisOption,
  targetLengthMeters = 4.6,
): { size: THREE.Vector3; scaleFactor: number } {
  model.position.set(0, 0, 0);
  model.rotation.set(0, getForwardAxisRotationY(forwardAxis), 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);

  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);

  const longitudinal = Math.max(initialSize.z, 0.001);
  const lateral = Math.max(initialSize.x, 0.001);
  const referenceSpan = Math.max(longitudinal, lateral * 0.5);
  const scaleFactor = targetLengthMeters / referenceSpan;

  model.scale.setScalar(scaleFactor);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);

  // Center X and Z at origin, rest bottom on Y = 0
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
  model.updateMatrixWorld(true);

  const finalSize = new THREE.Vector3();
  new THREE.Box3().setFromObject(model).getSize(finalSize);

  return { size: finalSize, scaleFactor };
}
