import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COMPONENT_CATALOG, COMPONENT_ORDER, ComponentId } from './componentCatalog';
import { CalibrationConfig, ForwardAxisOption } from './calibration';
import { LoadedVehicle, VehicleSourceKind, loadVehicleAsset } from './carBuilder';
import { BuiltInternalComponents, createInternalComponents } from './internalComponents';
import { EnergyFlowSystem, FlowAnimationState, createEnergyFlowSystem } from './energyFlowParticles';
import { RoadEnvironment, createRoadEnvironment } from './roadEnvironment';

export type ViewMode = 'exterior' | 'cutaway' | 'internal' | 'exploded' | 'energy_flow';
export type CameraPreset = 'isometric' | 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';

export interface SceneCallbacks {
  onSelectComponent: (id: ComponentId | null) => void;
  onVehicleLoaded: (info: {
    sourceKind: VehicleSourceKind;
    hasSeparableWheels: boolean;
    message: string;
  }) => void;
  onWebGLError: (message: string) => void;
}

export interface DrivingVisualState {
  active: boolean;
  speedMs: number;
  slopeDeg: number;
  powerDemandFraction: number;
  isRegenerating: boolean;
}

const PRESET_POSITIONS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: { pos: [4.6, 2.3, 4.9], target: [0, 0.72, 0.05] },
  front: { pos: [0, 1.3, 6.2], target: [0, 0.72, 0] },
  rear: { pos: [0, 1.35, -6.2], target: [0, 0.72, 0] },
  left: { pos: [-6.0, 1.25, 0], target: [0, 0.72, 0] },
  right: { pos: [6.0, 1.25, 0], target: [0, 0.72, 0] },
  top: { pos: [0, 6.8, 0.01], target: [0, 0.4, 0] },
  bottom: { pos: [0, -3.5, 2.4], target: [0, 0.6, 0] },
};

// Scratch math objects at module scope (zero GC inside animation loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _baseCompPos = new THREE.Vector3();
const _targetCompPos = new THREE.Vector3();
const _worldFocusPos = new THREE.Vector3();

export function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class HydroDriveSceneManager {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private vehicleAssembly!: THREE.Group;
  private currentVehicle: LoadedVehicle | null = null;
  private internals!: BuiltInternalComponents;
  private flowSystem!: EnergyFlowSystem;
  private roadEnv!: RoadEnvironment;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };

  private viewMode: ViewMode = 'cutaway';
  private customOpacity = 0.24;
  private currentBodyOpacity = 0.24;
  private targetBodyOpacity = 0.24;
  private explodeFactor = 0;
  private targetExplodeFactor = 0;

  private targetCarRotRad = { x: 0, y: 0, z: 0 };
  private autoRotateCar = false;
  private calibration!: CalibrationConfig;
  private componentVisibility: Record<ComponentId, boolean> = {
    h2_tank: true,
    fuel_cell: true,
    power_electronics: true,
    buffer_battery: true,
    electric_motor: true,
    thermal_system: true,
    drivetrain: true,
  };

  private drivingState: DrivingVisualState = {
    active: false,
    speedMs: 0,
    slopeDeg: 0,
    powerDemandFraction: 0.35,
    isRegenerating: false,
  };

  private flowState: FlowAnimationState = {
    playing: true,
    speedMultiplier: 1.0,
    mode: 'continuous',
    activeStepIndex: 0,
  };

  private cameraTransitionActive = false;
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private isContinuousLoop = false;
  private lastTimestamp = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, initialCalibration: CalibrationConfig, callbacks: SceneCallbacks) {
    this.container = container;
    this.calibration = initialCalibration;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.initScene();
    this.bindEvents();
    void this.loadInitialVehicle();
  }

  private initScene(): void {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
    } catch {
      this.callbacks.onWebGLError('WebGL is unavailable in this browser context.');
      return;
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.FogExp2(0x070b12, 0.028);

    // Mandatory studio environment reflection (RoomEnvironment) on all devices
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(...PRESET_POSITIONS.isometric.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.target.set(...PRESET_POSITIONS.isometric.target);
    this.controls.update();

    // Warm/cool studio lighting rig (max 1 shadow caster)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(5.5, 8.5, 5.5);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    const d = 4.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 0.85);
    this.scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-5, 3.5, -5);
    this.scene.add(rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xe0f2fe, 2.5, 5, 2);
      softbox.position.set(0, 4.2, 0);
      softbox.lookAt(0, 0.5, 0);
      this.scene.add(softbox);
    }

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.roadEnv = createRoadEnvironment(maxAniso);
    this.scene.add(this.roadEnv.group);

    // Master vehicle assembly: rotating this rotates car body + all internal components + flows together!
    this.vehicleAssembly = new THREE.Group();
    this.vehicleAssembly.name = 'VehicleMasterAssembly';
    this.scene.add(this.vehicleAssembly);

    this.internals = createInternalComponents(maxAniso);
    this.vehicleAssembly.add(this.internals.rootGroup);

    this.flowSystem = createEnergyFlowSystem();
    this.vehicleAssembly.add(this.flowSystem.group);

    this.applyCalibrationToMeshes();
    this.setViewMode('cutaway');
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.requestRender();
  }

  private async loadInitialVehicle(): Promise<void> {
    const { vehicle, message } = await loadVehicleAsset(this.calibration.forwardAxis);
    if (this.disposed) {
      vehicle.dispose();
      return;
    }
    this.attachVehicle(vehicle);
    this.callbacks.onVehicleLoaded({
      sourceKind: vehicle.sourceKind,
      hasSeparableWheels: vehicle.hasSeparableWheels,
      message,
    });
  }

  public async loadCustomGlbFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const { vehicle, message } = await loadVehicleAsset(this.calibration.forwardAxis, url);
      if (this.disposed) {
        vehicle.dispose();
        return;
      }
      this.attachVehicle(vehicle);
      this.callbacks.onVehicleLoaded({
        sourceKind: vehicle.sourceKind,
        hasSeparableWheels: vehicle.hasSeparableWheels,
        message,
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private attachVehicle(vehicle: LoadedVehicle): void {
    if (this.currentVehicle) {
      this.vehicleAssembly.remove(this.currentVehicle.wrapperGroup);
      this.currentVehicle.dispose();
    }
    this.currentVehicle = vehicle;
    this.vehicleAssembly.add(vehicle.wrapperGroup);
    this.syncBodyAppearance();
    this.requestRender();
  }

  private bindEvents(): void {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;

    this.controls.addEventListener('change', () => {
      if (!this.isContinuousLoop) this.requestRender();
    });

    this.controls.addEventListener('start', () => {
      // Cancel scripted camera transition immediately so user controls never fight it
      this.cameraTransitionActive = false;
    });

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onWebGLError('WebGL rendering context was lost.');
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return; // Ignore orbit drags

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.internals.clickTargets, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.componentId) {
        obj = obj.parent;
      }
      const compId = obj?.userData.componentId as ComponentId | undefined;
      if (compId && this.componentVisibility[compId]) {
        this.internals.setHighlightedComponent(compId);
        this.callbacks.onSelectComponent(compId);
        this.focusComponent(compId);
        return;
      }
    }
  };

  public handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.requestRender();
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    if (mode === 'exterior') {
      this.targetBodyOpacity = 1.0;
      this.targetExplodeFactor = 0.0;
      this.flowSystem.setVisible(false);
    } else if (mode === 'cutaway') {
      this.targetBodyOpacity = this.customOpacity;
      this.targetExplodeFactor = 0.0;
      this.flowSystem.setVisible(false);
    } else if (mode === 'internal') {
      this.targetBodyOpacity = 0.0;
      this.targetExplodeFactor = 0.0;
      this.flowSystem.setVisible(false);
    } else if (mode === 'exploded') {
      this.targetBodyOpacity = 0.14;
      this.targetExplodeFactor = 1.0;
      this.flowSystem.setVisible(false);
    } else if (mode === 'energy_flow') {
      this.targetBodyOpacity = Math.min(this.customOpacity, 0.28);
      this.targetExplodeFactor = 0.0;
      this.flowSystem.setVisible(true);
    }
    this.updateLoopMode();
    this.requestRender();
  }

  public setBodyOpacity(opacity: number): void {
    this.customOpacity = THREE.MathUtils.clamp(opacity, 0.05, 1.0);
    if (this.viewMode === 'cutaway' || this.viewMode === 'energy_flow') {
      this.targetBodyOpacity = this.customOpacity;
      this.requestRender();
    }
  }

  public setCarRotationDeg(xDeg: number, yDeg: number, zDeg: number): void {
    this.targetCarRotRad = {
      x: THREE.MathUtils.degToRad(xDeg),
      y: THREE.MathUtils.degToRad(yDeg),
      z: THREE.MathUtils.degToRad(zDeg),
    };
    this.requestRender();
  }

  public setAutoRotateCar(enabled: boolean): void {
    this.autoRotateCar = enabled;
    this.updateLoopMode();
    this.requestRender();
  }

  public setCameraPreset(preset: CameraPreset): void {
    const p = PRESET_POSITIONS[preset];
    _camGoalPos.set(...p.pos);
    _camGoalTarget.set(...p.target);
    this.cameraTransitionActive = true;
    this.requestRender();
  }

  public focusComponent(id: ComponentId): void {
    this.internals.setHighlightedComponent(id);
    const meta = COMPONENT_CATALOG[id];
    const group = this.internals.groups[id];
    group.getWorldPosition(_worldFocusPos);
    _camGoalTarget.copy(_worldFocusPos);
    _camGoalPos.set(
      _worldFocusPos.x + meta.cameraOffset[0],
      _worldFocusPos.y + meta.cameraOffset[1],
      _worldFocusPos.z + meta.cameraOffset[2],
    );
    this.cameraTransitionActive = true;
    this.requestRender();
  }

  public clearHighlight(): void {
    this.internals.setHighlightedComponent(null);
    this.requestRender();
  }

  public setComponentVisibility(id: ComponentId, visible: boolean): void {
    this.componentVisibility[id] = visible;
    this.internals.groups[id].visible = visible;
    this.requestRender();
  }

  public setCalibration(config: CalibrationConfig): void {
    const axisChanged = config.forwardAxis !== this.calibration.forwardAxis;
    this.calibration = config;
    if (axisChanged && this.currentVehicle) {
      this.currentVehicle.setForwardAxis(config.forwardAxis);
    }
    this.applyCalibrationToMeshes();
    this.requestRender();
  }

  private applyCalibrationToMeshes(): void {
    for (const id of COMPONENT_ORDER) {
      const cfg = this.calibration.components[id];
      const g = this.internals.groups[id];
      const [ex, ey, ez] = COMPONENT_CATALOG[id].explodedOffset;
      g.position.set(
        cfg.x + ex * this.explodeFactor,
        cfg.y + ey * this.explodeFactor,
        cfg.z + ez * this.explodeFactor,
      );
      g.rotation.set(
        THREE.MathUtils.degToRad(cfg.rx),
        THREE.MathUtils.degToRad(cfg.ry),
        THREE.MathUtils.degToRad(cfg.rz),
      );
      g.scale.setScalar(cfg.scale);
    }
  }

  public setDrivingState(state: DrivingVisualState): void {
    this.drivingState = state;
    this.updateLoopMode();
    this.requestRender();
  }

  public setFlowAnimationState(state: FlowAnimationState): void {
    this.flowState = state;
    this.updateLoopMode();
    this.requestRender();
  }

  public captureScreenshot(): string | null {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private syncBodyAppearance(): void {
    if (!this.currentVehicle) return;
    const showBody = this.viewMode !== 'internal' && this.currentBodyOpacity > 0.02;
    this.currentVehicle.applyBodyAppearance(this.currentBodyOpacity, showBody);
  }

  private needsContinuousAnimation(): boolean {
    const flowRunning = this.viewMode === 'energy_flow' && this.flowState.playing;
    const drivingRunning = this.drivingState.active && this.drivingState.speedMs > 0.05;
    return flowRunning || drivingRunning || this.autoRotateCar;
  }

  private updateLoopMode(): void {
    const shouldLoop = this.needsContinuousAnimation();
    if (shouldLoop && !this.isContinuousLoop) {
      this.isContinuousLoop = true;
      this.lastTimestamp = performance.now();
      this.scheduleContinuousTick();
    } else if (!shouldLoop) {
      this.isContinuousLoop = false;
    }
  }

  private scheduleContinuousTick(): void {
    if (this.disposed || !this.isContinuousLoop) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private advanceSimulationStep(dt: number): boolean {
    let stillTransitioning = false;

    // 1. Vehicle 3-axis rotation damping
    if (this.autoRotateCar) {
      this.targetCarRotRad.y += dt * 0.45;
    }
    this.vehicleAssembly.rotation.x = THREE.MathUtils.damp(
      this.vehicleAssembly.rotation.x,
      this.targetCarRotRad.x,
      8,
      dt,
    );
    this.vehicleAssembly.rotation.y = THREE.MathUtils.damp(
      this.vehicleAssembly.rotation.y,
      this.targetCarRotRad.y,
      8,
      dt,
    );
    this.vehicleAssembly.rotation.z = THREE.MathUtils.damp(
      this.vehicleAssembly.rotation.z,
      this.targetCarRotRad.z,
      8,
      dt,
    );

    if (
      Math.abs(this.vehicleAssembly.rotation.x - this.targetCarRotRad.x) > 0.002 ||
      Math.abs(this.vehicleAssembly.rotation.y - this.targetCarRotRad.y) > 0.002 ||
      Math.abs(this.vehicleAssembly.rotation.z - this.targetCarRotRad.z) > 0.002
    ) {
      stillTransitioning = true;
    }

    // 2. Cutaway opacity damping
    if (Math.abs(this.currentBodyOpacity - this.targetBodyOpacity) > 0.005) {
      this.currentBodyOpacity = THREE.MathUtils.damp(
        this.currentBodyOpacity,
        this.targetBodyOpacity,
        9,
        dt,
      );
      this.syncBodyAppearance();
      stillTransitioning = true;
    } else if (this.currentBodyOpacity !== this.targetBodyOpacity) {
      this.currentBodyOpacity = this.targetBodyOpacity;
      this.syncBodyAppearance();
    }

    // 3. Exploded view damping + guide lines
    if (Math.abs(this.explodeFactor - this.targetExplodeFactor) > 0.004) {
      this.explodeFactor = THREE.MathUtils.damp(this.explodeFactor, this.targetExplodeFactor, 7, dt);
      this.applyCalibrationToMeshes();
      stillTransitioning = true;
    } else if (this.explodeFactor !== this.targetExplodeFactor) {
      this.explodeFactor = this.targetExplodeFactor;
      this.applyCalibrationToMeshes();
    }

    this.internals.updateExplodedGuides(
      this.explodeFactor,
      (id) => this.internals.groups[id].position,
      (id) => {
        const cfg = this.calibration.components[id];
        return _baseCompPos.set(cfg.x, cfg.y, cfg.z);
      },
    );

    // 4. Camera preset / focus damping
    if (this.cameraTransitionActive) {
      const k = 1 - Math.exp(-7 * dt);
      this.camera.position.lerp(_camGoalPos, k);
      this.controls.target.lerp(_camGoalTarget, k);
      if (
        this.camera.position.distanceTo(_camGoalPos) < 0.02 &&
        this.controls.target.distanceTo(_camGoalTarget) < 0.02
      ) {
        this.camera.position.copy(_camGoalPos);
        this.controls.target.copy(_camGoalTarget);
        this.cameraTransitionActive = false;
      } else {
        stillTransitioning = true;
      }
    }

    // 5. Driving animation (wheel angular velocity omega = v / r, motor rotor spin, moving road)
    if (this.drivingState.active && this.drivingState.speedMs > 0.05) {
      const omega = this.drivingState.speedMs / (this.currentVehicle?.wheelRadiusMeters ?? 0.34);
      if (this.currentVehicle?.hasSeparableWheels) {
        this.currentVehicle.wheels.forEach((w) => {
          w.rotation.x += omega * dt;
        });
      }
      this.internals.motorRotor.rotation.x += omega * 4.5 * dt;
      this.roadEnv.updateDriving(dt, this.drivingState.speedMs, this.drivingState.slopeDeg);
    } else {
      this.roadEnv.updateDriving(dt, 0, 0);
    }

    // 6. Energy flow particle updates
    if (this.viewMode === 'energy_flow') {
      this.flowSystem.update(
        dt,
        this.drivingState.powerDemandFraction,
        this.drivingState.isRegenerating,
        this.flowState,
      );
    }

    void _targetCompPos;
    return stillTransitioning;
  }

  private tick(): void {
    if (this.disposed || !this.isContinuousLoop) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.08);
    this.lastTimestamp = now;

    this.advanceSimulationStep(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.scheduleContinuousTick();
  }

  public requestRender(): void {
    if (this.disposed || !this.renderer || this.isContinuousLoop) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    const startT = performance.now();
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      const now = performance.now();
      const dt = Math.min(Math.max((now - startT) / 1000, 0.016), 0.05);
      const keepGoing = this.advanceSimulationStep(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      const done = () => {
        this.renderBusy = false;
        if ((this.renderDirty || keepGoing) && !this.disposed && !this.isContinuousLoop) {
          this.requestRender();
        }
      };
      if (this.isSoftwareGl) {
        this.afterDraw(done);
      } else {
        done();
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
      this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    }
    this.controls?.dispose();
    this.currentVehicle?.dispose();
    this.internals?.dispose();
    this.flowSystem?.dispose();
    this.roadEnv?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
