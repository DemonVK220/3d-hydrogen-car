import * as THREE from 'three';

export interface RoadEnvironment {
  group: THREE.Group;
  updateDriving: (dt: number, speedMs: number, slopeDeg: number) => void;
  dispose: () => void;
}

export function createRoadEnvironment(maxAnisotropy = 4): RoadEnvironment {
  const group = new THREE.Group();
  group.name = 'StudioRoadEnvironment';
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Studio Floor Plane
  const floorGeo = track(new THREE.CircleGeometry(28, 64));
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.78,
      metalness: 0.15,
    }),
  );
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.position.y = -0.005;
  group.add(floor);

  // Subtle calibrated engineering grid (offset >= 0.015 so zero Z-fighting)
  const grid = new THREE.GridHelper(28, 28, 0x1e293b, 0x111c2e);
  grid.position.y = 0.008;
  group.add(grid);

  // Soft radial contact shadow beneath the car
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(128, 128, 18, 128, 128, 126);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);
  }
  const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
  shadowTex.anisotropy = maxAnisotropy;
  const contactShadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(3.2, 5.4)),
    track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    ),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  group.add(contactShadow);

  // Scrolling Road Strip & Lane Chevrons for Animated Driving Mode
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 256;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d');
  if (rCtx) {
    rCtx.fillStyle = '#0E1726';
    rCtx.fillRect(0, 0, 256, 512);

    // Side lane lines
    rCtx.fillStyle = '#1E3A5F';
    rCtx.fillRect(10, 0, 6, 512);
    rCtx.fillRect(240, 0, 6, 512);

    // Dashed centerline
    rCtx.fillStyle = '#38BDF8';
    for (let y = 24; y < 512; y += 128) {
      rCtx.fillRect(123, y, 10, 64);
    }
  }
  const roadTex = track(new THREE.CanvasTexture(roadCanvas));
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 6);
  roadTex.anisotropy = maxAnisotropy;

  const roadStrip = new THREE.Mesh(
    track(new THREE.PlaneGeometry(3.8, 24)),
    track(
      new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: 0.85,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    ),
  );
  roadStrip.rotation.x = -Math.PI / 2;
  roadStrip.position.y = 0.022;
  roadStrip.receiveShadow = true;
  roadStrip.visible = false;
  group.add(roadStrip);

  const updateDriving = (dt: number, speedMs: number, slopeDeg: number) => {
    const active = speedMs > 0.1;
    roadStrip.visible = active;
    if (active) {
      // Scroll road texture opposite to +Z forward motion
      roadTex.offset.y = (roadTex.offset.y + (speedMs * dt) / 4.0) % 1;
      // Subtle visual incline tilt on road strip only when grade != 0
      roadStrip.rotation.x = -Math.PI / 2 - THREE.MathUtils.degToRad(slopeDeg * 0.6);
    }
  };

  return {
    group,
    updateDriving,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
