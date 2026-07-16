"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Hammer, Shield, Coins, Crown, Flame, Moon } from "lucide-react";

interface ThreeDMapProps {
  selectedNpcId: string;
  setSelectedNpcId: (id: string) => void;
  handleAdvanceDay: () => void;
  isGossiping: boolean;
  gameEnded: boolean;
  helpModeActive: boolean;
  setActiveHelpSection: (section: string) => void;
  showNotification: (msg: string, type: "info" | "success" | "warning" | "error") => void;
}

export default function ThreeDMap({
  selectedNpcId,
  setSelectedNpcId,
  handleAdvanceDay,
  isGossiping,
  gameEnded,
  helpModeActive,
  setActiveHelpSection,
  showNotification,
}: ThreeDMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Store interactive meshes for raycasting
  const interactiveObjectsRef = useRef<{ mesh: THREE.Object3D; id: string; name: string }[]>([]);

  // Refs for tracking mutable states inside the empty dependency useEffect
  const selectedNpcIdRef = useRef(selectedNpcId);
  const isGossipingRef = useRef(isGossiping);
  const gameEndedRef = useRef(gameEnded);
  const showNotificationRef = useRef(showNotification);
  const handleAdvanceDayRef = useRef(handleAdvanceDay);

  useEffect(() => { selectedNpcIdRef.current = selectedNpcId; }, [selectedNpcId]);
  useEffect(() => { isGossipingRef.current = isGossiping; }, [isGossiping]);
  useEffect(() => { gameEndedRef.current = gameEnded; }, [gameEnded]);
  useEffect(() => { showNotificationRef.current = showNotification; }, [showNotification]);
  useEffect(() => { handleAdvanceDayRef.current = handleAdvanceDay; }, [handleAdvanceDay]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#ebdcb9"); // Parchment light mode background
    scene.fog = new THREE.FogExp2("#ebdcb9", 0.035);

    // --- 2. Camera Setup ---
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 11, 13);
    camera.lookAt(0, -0.5, 0);

    // --- 3. Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- 4. Lights ---
    // Ambient Light
    const ambientLight = new THREE.AmbientLight("#fff1e0", 1.2);
    scene.add(ambientLight);

    // Directional (Sun) Light
    const dirLight = new THREE.DirectionalLight("#fff9eb", 1.8);
    dirLight.position.set(10, 15, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 8;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Campfire Point Light
    const fireLight = new THREE.PointLight("#ff7700", 2.5, 8);
    fireLight.position.set(0, 0.5, 0);
    fireLight.castShadow = true;
    scene.add(fireLight);

    // Selection spotlight indicator
    const selectionLight = new THREE.SpotLight("#ffffff", 0, 8, Math.PI / 8, 0.5, 1);
    selectionLight.position.set(0, 6, 0);
    scene.add(selectionLight);
    const selectionTarget = new THREE.Object3D();
    scene.add(selectionTarget);
    selectionLight.target = selectionTarget;

    // --- 5. Custom Geometries & Materials (Cartoon Toon Shading style) ---
    // Common colors
    const colors = {
      grass: "#7ba342",
      path: "#dfc68b",
      plaza: "#5c6875",
      wood: "#8c5832",
      roofForge: "#a84424",
      roofBarracks: "#3b485c",
      roofExchange: "#c2512f",
      roofCouncil: "#522d5c",
      forgeBase: "#4a3b2c",
      barracksBase: "#2e3b4e",
      exchangeBase: "#6b4224",
      councilBase: "#452d4e",
    };

    // Toon Materials (flat-shaded cartoon look)
    const materials = {
      grass: new THREE.MeshLambertMaterial({ color: colors.grass }),
      path: new THREE.MeshLambertMaterial({ color: colors.path }),
      plaza: new THREE.MeshLambertMaterial({ color: colors.plaza }),
      wood: new THREE.MeshLambertMaterial({ color: colors.wood }),
      smoke: new THREE.MeshBasicMaterial({ color: "#aaaaaa", transparent: true, opacity: 0.6 }),
      fire: new THREE.MeshBasicMaterial({ color: "#ff3b30" }),
      fireOrange: new THREE.MeshBasicMaterial({ color: "#ff9500" }),
      fireYellow: new THREE.MeshBasicMaterial({ color: "#ffcc00" }),
      gold: new THREE.MeshStandardMaterial({ color: "#ffd700", metalness: 0.8, roughness: 0.2 }),
      cyanGlow: new THREE.MeshBasicMaterial({ color: "#00f0ff", transparent: true, opacity: 0.35 }),
      selectionRing: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    };

    // --- 6. Environment Layout ---
    // Ground Grass Cylinder (with rounded rim)
    const groundGeo = new THREE.CylinderGeometry(8.5, 8.8, 1, 32);
    const ground = new THREE.Mesh(groundGeo, materials.grass);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Central plaza
    const plazaGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 24);
    const plaza = new THREE.Mesh(plazaGeo, materials.plaza);
    plaza.position.set(0, 0.02, 0);
    plaza.receiveShadow = true;
    scene.add(plaza);

    // Cross Paths
    const createPath = (w: number, l: number, rx: number, rz: number) => {
      const pathGeo = new THREE.PlaneGeometry(w, l);
      const pathMesh = new THREE.Mesh(pathGeo, materials.path);
      pathMesh.rotation.x = -Math.PI / 2;
      pathMesh.position.set(rx, 0.01, rz);
      pathMesh.receiveShadow = true;
      scene.add(pathMesh);
    };
    // Left-to-Right Path
    createPath(13, 0.8, 0, 0);
    // Top-to-Bottom Path
    createPath(0.8, 9, 0, 0);

    // --- 7. Cartoon Buildings ---
    interactiveObjectsRef.current = [];

    // Auxiliary to store references to custom floaters
    const floaters: { mesh: THREE.Object3D; startY: number; offset: number }[] = [];

    const addInteractiveBuilding = (
      id: string,
      name: string,
      px: number,
      pz: number,
      createVisuals: (group: THREE.Group) => void,
      floaterVisuals: (group: THREE.Group) => void
    ) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(px, 0, pz);

      // Shadow receiver plate
      const plateGeo = new THREE.BoxGeometry(2.4, 0.1, 2.4);
      const plateMat = new THREE.MeshLambertMaterial({ color: colors.plaza });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.y = 0.05;
      plate.receiveShadow = true;
      bGroup.add(plate);

      // Building visual structures
      createVisuals(bGroup);

      // Floating indicator visual structures
      const fGroup = new THREE.Group();
      fGroup.position.set(0, 2.3, 0);
      floaterVisuals(fGroup);
      bGroup.add(fGroup);

      // Store floater for bobbing animation
      floaters.push({
        mesh: fGroup,
        startY: 2.3,
        offset: Math.random() * Math.PI * 2,
      });

      // Hitbox for raycasting
      const hitboxGeo = new THREE.BoxGeometry(2.5, 2.8, 2.5);
      const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
      hitbox.position.y = 1.2;
      bGroup.add(hitbox);

      scene.add(bGroup);
      interactiveObjectsRef.current.push({ mesh: hitbox, id, name });
    };

    // --- A. HAGAR'S FORGE (Top-Left) ---
    addInteractiveBuilding(
      "blacksmith",
      "Hagar's Forge",
      -3.8,
      -2.8,
      (g) => {
        // Base structure
        const baseGeo = new THREE.BoxGeometry(1.6, 1.1, 1.6);
        const baseMat = new THREE.MeshLambertMaterial({ color: colors.forgeBase });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);

        // Slanted Roof
        const roofGeo = new THREE.ConeGeometry(1.3, 0.8, 4);
        const roofMat = new THREE.MeshLambertMaterial({ color: colors.roofForge });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.set(0, 1.45, 0);
        roof.castShadow = true;
        g.add(roof);

        // Chimney
        const chimneyGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const chimneyMat = new THREE.MeshLambertMaterial({ color: "#444444" });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(0.5, 1.4, 0.5);
        chimney.castShadow = true;
        g.add(chimney);

        // Glow Hearth door
        const hearthGeo = new THREE.BoxGeometry(0.4, 0.6, 0.1);
        const hearthMat = new THREE.MeshBasicMaterial({ color: "#ff5500" });
        const hearth = new THREE.Mesh(hearthGeo, hearthMat);
        hearth.position.set(0, 0.35, 0.81);
        g.add(hearth);
      },
      (f) => {
        // Glowing hammer icon
        const handleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
        const handle = new THREE.Mesh(handleGeo, materials.wood);
        handle.rotation.z = Math.PI / 4;
        f.add(handle);

        const headGeo = new THREE.BoxGeometry(0.35, 0.22, 0.22);
        const head = new THREE.Mesh(headGeo, materials.gold);
        head.position.set(0.2, 0.2, 0);
        head.rotation.z = Math.PI / 4;
        f.add(head);
      }
    );

    // --- B. KAEL'S BARRACKS (Top-Right) ---
    addInteractiveBuilding(
      "guard",
      "Kael's Barracks",
      3.8,
      -2.8,
      (g) => {
        // Castle tower base
        const towerGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 16);
        const towerMat = new THREE.MeshLambertMaterial({ color: colors.barracksBase });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 0.7;
        tower.castShadow = true;
        tower.receiveShadow = true;
        g.add(tower);

        // Top crenellations platform
        const topGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.3, 16);
        const topMesh = new THREE.Mesh(topGeo, towerMat);
        topMesh.position.y = 1.5;
        topMesh.castShadow = true;
        g.add(topMesh);

        // 4 small crenellation teeth
        for (let i = 0; i < 4; i++) {
          const toothGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
          const tooth = new THREE.Mesh(toothGeo, towerMat);
          const angle = (i * Math.PI) / 2 + Math.PI / 4;
          tooth.position.set(Math.cos(angle) * 0.8, 1.7, Math.sin(angle) * 0.8);
          g.add(tooth);
        }

        // Pulse defense ring visual
        const ringGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.05, 16, 1, true);
        const ring = new THREE.Mesh(ringGeo, materials.cyanGlow);
        ring.position.y = 0.6;
        g.add(ring);
        // Save reference to animate it
        (g as any).pulseRing = ring;
      },
      (f) => {
        // Shield icon
        const shieldPlateGeo = new THREE.BoxGeometry(0.5, 0.6, 0.1);
        const shieldPlate = new THREE.Mesh(shieldPlateGeo, materials.gold);
        f.add(shieldPlate);

        const trimGeo = new THREE.BoxGeometry(0.1, 0.7, 0.15);
        const trim = new THREE.Mesh(trimGeo, new THREE.MeshBasicMaterial({ color: "#00f0ff" }));
        trim.position.set(0, 0, 0.01);
        f.add(trim);
      }
    );

    // --- C. SILAS'S EXCHANGE (Bottom-Left) ---
    addInteractiveBuilding(
      "merchant",
      "Silas's Exchange",
      -3.8,
      2.8,
      (g) => {
        // Base stall
        const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 1.3);
        const baseMat = new THREE.MeshLambertMaterial({ color: colors.exchangeBase });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.4;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);

        // Canopy posts
        const postMat = new THREE.MeshLambertMaterial({ color: colors.wood });
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), postMat);
        p1.position.set(-0.7, 1.0, -0.5);
        p1.castShadow = true;
        g.add(p1);
        const p2 = p1.clone();
        p2.position.set(0.7, 1.0, -0.5);
        g.add(p2);
        const p3 = p1.clone();
        p3.position.set(-0.7, 1.0, 0.5);
        g.add(p3);
        const p4 = p1.clone();
        p4.position.set(0.7, 1.0, 0.5);
        g.add(p4);

        // Striped canopy roof
        const roofGeo = new THREE.BoxGeometry(1.9, 0.15, 1.5);
        const roofMat = new THREE.MeshLambertMaterial({ color: colors.roofExchange });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 1.6, 0);
        roof.rotation.x = 0.08;
        roof.castShadow = true;
        g.add(roof);

        // Stall counters
        const boxGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const boxMat = new THREE.MeshLambertMaterial({ color: "#b57a55" });
        const crate = new THREE.Mesh(boxGeo, boxMat);
        crate.position.set(-0.4, 0.9, 0.1);
        crate.rotation.y = 0.25;
        crate.castShadow = true;
        g.add(crate);
      },
      (f) => {
        // Gold Coin floater
        const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
        const coin = new THREE.Mesh(coinGeo, materials.gold);
        coin.rotation.x = Math.PI / 2;
        f.add(coin);
      }
    );

    // --- D. EVELYN'S COUNCIL (Bottom-Right) ---
    addInteractiveBuilding(
      "mayor",
      "Evelyn's Council",
      3.8,
      2.8,
      (g) => {
        // Base admin building
        const baseGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
        const baseMat = new THREE.MeshLambertMaterial({ color: colors.councilBase });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);

        // Grand purple dome
        const domeGeo = new THREE.SphereGeometry(0.9, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshLambertMaterial({ color: colors.roofCouncil });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.set(0, 1.2, 0);
        dome.castShadow = true;
        g.add(dome);

        // Miniature Pillars
        const pillGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
        const pillMat = new THREE.MeshLambertMaterial({ color: "#dddddd" });
        const pillL = new THREE.Mesh(pillGeo, pillMat);
        pillL.position.set(-0.5, 0.4, 0.82);
        pillL.castShadow = true;
        g.add(pillL);
        const pillR = pillL.clone();
        pillR.position.x = 0.5;
        g.add(pillR);
      },
      (f) => {
        // Golden crown floater
        const crownBaseGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12, 1, true);
        const crownBase = new THREE.Mesh(crownBaseGeo, materials.gold);
        f.add(crownBase);

        // Add crown spikes
        for (let i = 0; i < 5; i++) {
          const spikeGeo = new THREE.ConeGeometry(0.05, 0.15, 4);
          const spike = new THREE.Mesh(spikeGeo, materials.gold);
          const angle = (i * Math.PI * 2) / 5;
          spike.position.set(Math.cos(angle) * 0.25, 0.15, Math.sin(angle) * 0.25);
          spike.rotation.y = angle;
          f.add(spike);
        }
      }
    );

    // --- 8. CENTRAL CAMPFIRE & SLEEP TRIGGER ---
    const campfireGroup = new THREE.Group();
    campfireGroup.position.set(0, 0, 0);

    // Campfire wood logs star
    const logMat = new THREE.MeshLambertMaterial({ color: "#3d2511" });
    const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.rotation.y = (i * Math.PI) / 4;
      log.rotation.z = Math.PI / 2 + 0.15;
      log.position.y = 0.06;
      log.castShadow = true;
      campfireGroup.add(log);
    }

    // Flame particles
    const flameCount = 5;
    const flameMeshes: THREE.Mesh[] = [];
    const flameGeo = new THREE.ConeGeometry(0.18, 0.5, 5);

    for (let i = 0; i < flameCount; i++) {
      const mat = i % 3 === 0 ? materials.fire : i % 3 === 1 ? materials.fireOrange : materials.fireYellow;
      const flame = new THREE.Mesh(flameGeo, mat);
      // Scattered positions
      const angle = (i * Math.PI * 2) / flameCount;
      const radius = 0.12;
      flame.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
      campfireGroup.add(flame);
      flameMeshes.push(flame);
    }
    scene.add(campfireGroup);

    // Hitbox for campfire
    const fireHitboxGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.2, 12);
    const fireHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const fireHitbox = new THREE.Mesh(fireHitboxGeo, fireHitboxMat);
    fireHitbox.position.y = 0.6;
    campfireGroup.add(fireHitbox);
    interactiveObjectsRef.current.push({ mesh: fireHitbox, id: "campfire", name: "Sleep & Gossip campfire" });

    // --- 9. Trees & Rocks decoration ---
    const addTree = (tx: number, tz: number, scaleMultiplier = 1.0) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      const trunkGeo = new THREE.CylinderGeometry(0.12 * scaleMultiplier, 0.15 * scaleMultiplier, 0.9 * scaleMultiplier, 8);
      const trunk = new THREE.Mesh(trunkGeo, materials.wood);
      trunk.position.y = 0.45 * scaleMultiplier;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliageGeo = new THREE.ConeGeometry(0.7 * scaleMultiplier, 1.5 * scaleMultiplier, 8);
      const foliageMat = new THREE.MeshLambertMaterial({ color: "#2e5c1e" });
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 1.35 * scaleMultiplier;
      foliage.castShadow = true;
      tree.add(foliage);

      scene.add(tree);
    };

    // Scatters of cartoon trees
    addTree(-6.5, -4.5, 1.2);
    addTree(-5.5, -5.2, 0.95);
    addTree(6.5, -4.8, 1.1);
    addTree(5.5, -5.4, 0.9);
    addTree(-6.8, 4.2, 1.0);
    addTree(6.8, 4.5, 1.15);
    addTree(0, -6.5, 1.3);
    addTree(0, 6.5, 1.2);

    const addRock = (rx: number, rz: number, s: number) => {
      const rockGeo = new THREE.DodecahedronGeometry(s, 0);
      const rockMat = new THREE.MeshLambertMaterial({ color: "#858c94" });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, s * 0.6, rz);
      rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      rock.castShadow = true;
      scene.add(rock);
    };
    // Scattered Rocks
    addRock(-5.0, 1.5, 0.35);
    addRock(5.2, 1.2, 0.4);
    addRock(-2.0, -5.0, 0.3);
    addRock(2.5, -4.8, 0.45);

    // --- 10. Smoke particles from Hagar's chimney ---
    const smokeParticles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
    const chimneyGlobalPos = new THREE.Vector3(-3.8 + 0.5, 1.4, -2.8 + 0.5);

    const spawnSmoke = () => {
      const smokeGeo = new THREE.SphereGeometry(0.12, 5, 5);
      const smoke = new THREE.Mesh(smokeGeo, materials.smoke.clone() as THREE.Material);
      smoke.position.copy(chimneyGlobalPos);
      scene.add(smoke);
      smokeParticles.push({
        mesh: smoke,
        vx: (Math.random() - 0.5) * 0.015,
        vy: 0.02 + Math.random() * 0.015,
        vz: (Math.random() - 0.5) * 0.015,
        life: 1.0,
      });
    };

        // --- 11. Player Mesh & Walking Logic ---
    const activeNPCCoordinates: Record<string, { x: number; z: number }> = {
      blacksmith: { x: -3.8, z: -2.8 },
      guard: { x: 3.8, z: -2.8 },
      merchant: { x: -3.8, z: 2.8 },
      mayor: { x: 3.8, z: 2.8 },
    };

    // Track active target selection
    let activeNpcId = selectedNpcIdRef.current;

    // Player Group
    const playerGroup = new THREE.Group();
    const startCoords = activeNPCCoordinates[activeNpcId] || { x: 0, z: 0 };
    playerGroup.position.set(startCoords.x, 0.05, startCoords.z);
    scene.add(playerGroup);

    // Player Body (capsule / cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.45, 12);
    const bodyMat = new THREE.MeshLambertMaterial({ color: "#00f0ff" });
    const playerBody = new THREE.Mesh(bodyGeo, bodyMat);
    playerBody.position.y = 0.225;
    playerBody.castShadow = true;
    playerGroup.add(playerBody);

    // Player Visor/Face
    const visorGeo = new THREE.BoxGeometry(0.25, 0.08, 0.1);
    const visorMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.12, 0.16); // Face forward (+Z direction)
    playerBody.add(visor);

    // Left Leg
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8);
    const legMat = new THREE.MeshLambertMaterial({ color: "#00b0df" });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.08, -0.09, 0); // attached at hips
    playerBody.add(leftLeg);

    // Right Leg
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.08;
    playerBody.add(rightLeg);

    // Floating YOU marker above player
    const markerGeo = new THREE.ConeGeometry(0.1, 0.22, 4);
    const markerMat = new THREE.MeshBasicMaterial({ color: "#00f0ff" });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.y = 0.8;
    marker.rotation.z = Math.PI; // point down
    playerGroup.add(marker);

    // Path waypoints
    let waypoints: { x: number; z: number }[] = [];
    const speed = 4.2; // units per second

    const getPathWaypoints = (startX: number, startZ: number, endX: number, endZ: number): { x: number; z: number }[] => {
      const points: { x: number; z: number }[] = [];
      // 1. Move to the horizontal street z=0
      if (startZ !== 0) {
        points.push({ x: startX, z: 0 });
      }
      // 2. Move to the center plaza (0,0)
      if (startX !== 0) {
        points.push({ x: 0, z: 0 });
      }
      // 3. Move along the street to align with target's X/Z
      if (endZ !== 0) {
        points.push({ x: 0, z: endZ });
      }
      // 4. Move to final target
      points.push({ x: endX, z: endZ });
      return points;
    };

    // Dust particles
    const dustParticles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
    const spawnDust = (px: number, pz: number) => {
      const dustGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const dustMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5 });
      const dust = new THREE.Mesh(dustGeo, dustMat);
      dust.position.set(px + (Math.random() - 0.5) * 0.2, 0.02, pz + (Math.random() - 0.5) * 0.2);
      scene.add(dust);
      dustParticles.push({
        mesh: dust,
        vx: (Math.random() - 0.5) * 0.005,
        vy: 0.008 + Math.random() * 0.008,
        vz: (Math.random() - 0.5) * 0.005,
        life: 1.0,
      });
    };

    // Dynamic selection ring mesh
    const ringGeo = new THREE.RingGeometry(1.2, 1.35, 32);
    const selectionRing = new THREE.Mesh(ringGeo, materials.selectionRing);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.05;
    scene.add(selectionRing);

    // --- 12. Animation Loop ---
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let wasGossiping = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();
      const deltaTime = Math.min(clock.getDelta(), 0.1);

      // Flickering campfire PointLight intensity
      fireLight.intensity = 2.5 + Math.sin(time * 15) * 0.4 + Math.cos(time * 28) * 0.2;

      // Animate cartoon flames (scaling cone geometry height)
      flameMeshes.forEach((flame, index) => {
        const offset = index * 1.5;
        const scaleVal = 0.8 + Math.sin(time * 12 + offset) * 0.25;
        flame.scale.set(1, scaleVal, 1);
        flame.position.y = 0.18 + (scaleVal - 0.8) * 0.1;
      });

      // Floaters bobbing & spinning
      floaters.forEach((item) => {
        item.mesh.position.y = item.startY + Math.sin(time * 3 + item.offset) * 0.12;
        item.mesh.rotation.y = time * 0.9;
      });

      // Animate Kael's barracks pulsating defense shield ring
      scene.traverse((obj) => {
        if ((obj as any).pulseRing) {
          const pRing = (obj as any).pulseRing;
          const scale = 1.0 + Math.sin(time * 4) * 0.15;
          pRing.scale.set(scale, 1, scale);
        }
      });

      // Animate Hagar's chimney smoke
      if (Math.random() < 0.1) {
        spawnSmoke();
      }
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life -= 0.015;

        // Scale up and fade out
        const currentScale = 1.0 + (1.0 - p.life) * 2.0;
        p.mesh.scale.set(currentScale, currentScale, currentScale);
        const mat = p.mesh.material as any;
        mat.opacity = p.life * 0.55;

        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          mat.dispose();
          smokeParticles.splice(i, 1);
        }
      }

      // Check for changes in selection
      const targetNpcId = selectedNpcIdRef.current;
      if (targetNpcId !== activeNpcId) {
        const dest = activeNPCCoordinates[targetNpcId];
        if (dest) {
          waypoints = getPathWaypoints(playerGroup.position.x, playerGroup.position.z, dest.x, dest.z);
        }
        activeNpcId = targetNpcId;
      }

      // Check for campfire sleep transition
      const isGossipingNow = isGossipingRef.current;
      if (isGossipingNow && !wasGossiping) {
        waypoints = getPathWaypoints(playerGroup.position.x, playerGroup.position.z, 0, 0);
        wasGossiping = true;
      } else if (!isGossipingNow && wasGossiping) {
        wasGossiping = false;
      }

      // Move player along waypoints
      if (waypoints.length > 0) {
        const nextPoint = waypoints[0];
        const dist = Math.hypot(nextPoint.x - playerGroup.position.x, nextPoint.z - playerGroup.position.z);
        const step = speed * deltaTime;

        if (step >= dist) {
          playerGroup.position.set(nextPoint.x, playerGroup.position.y, nextPoint.z);
          waypoints.shift();
        } else {
          const dx = (nextPoint.x - playerGroup.position.x) / dist;
          const dz = (nextPoint.z - playerGroup.position.z) / dist;
          playerGroup.position.x += dx * step;
          playerGroup.position.z += dz * step;

          // Face walk direction
          const targetAngle = Math.atan2(dx, dz);
          playerGroup.rotation.y = targetAngle;
        }

        // Bob body and swing legs
        const walkCycle = time * 16;
        playerBody.position.y = 0.225 + Math.abs(Math.sin(walkCycle)) * 0.08;
        leftLeg.rotation.x = Math.sin(walkCycle) * 0.5;
        rightLeg.rotation.x = -Math.sin(walkCycle) * 0.5;

        // Spawn movement dust
        if (Math.random() < 0.25) {
          spawnDust(playerGroup.position.x, playerGroup.position.z);
        }
      } else {
        // Idle state: bob gently, restore leg rotation, face camera
        playerBody.position.y = 0.225 + Math.sin(time * 2.5) * 0.02;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, 0, 0.08);
      }

      // Marker animation
      marker.position.y = 0.75 + Math.sin(time * 4) * 0.06;
      marker.rotation.y = time * 1.5;

      // Animate dust particles
      for (let i = dustParticles.length - 1; i >= 0; i--) {
        const p = dustParticles[i];
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life -= 0.04;

        const currentScale = 1.0 + (1.0 - p.life) * 1.5;
        p.mesh.scale.set(currentScale, currentScale, currentScale);
        const mat = p.mesh.material as any;
        mat.opacity = p.life * 0.5;

        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          mat.dispose();
          dustParticles.splice(i, 1);
        }
      }

      // Keep selection spot and ring matching active target
      const coords = activeNPCCoordinates[activeNpcId];
      if (coords) {
        selectionRing.visible = true;
        selectionRing.position.set(coords.x, 0.05, coords.z);
        materials.selectionRing.opacity = 0.5 + Math.sin(time * 6) * 0.2;

        selectionLight.intensity = 1.5;
        selectionLight.position.set(coords.x, 6, coords.z);
        selectionTarget.position.set(coords.x, 0, coords.z);
      } else {
        selectionRing.visible = false;
        selectionLight.intensity = 0;
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- 13. Raycasting & Mouse Interaction ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh: THREE.Object3D | null = null;

    const getMouseCoords = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { x, y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const coords = getMouseCoords(e);
      mouse.x = coords.x;
      mouse.y = coords.y;

      // Update Tooltip Coordinates
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 35,
      });

      // Tilt camera slightly based on mouse (parallax tilt)
      const targetCamX = mouse.x * 0.8;
      const targetCamZ = 13 + mouse.y * 0.6;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.15);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.15);
      camera.lookAt(0, -0.5, 0);

      // Perform Raycast
      raycaster.setFromCamera(mouse, camera);
      const hitboxes = interactiveObjectsRef.current.map((o) => o.mesh);
      const intersects = raycaster.intersectObjects(hitboxes);

      if (intersects.length > 0) {
        const hitHitbox = intersects[0].object;
        const matched = interactiveObjectsRef.current.find((o) => o.mesh === hitHitbox);

        if (matched) {
          if (hoveredMesh !== matched.mesh) {
            if (hoveredMesh) {
              hoveredMesh.parent?.scale.set(1.0, 1.0, 1.0);
            }
            hoveredMesh = matched.mesh;
            matched.mesh.parent?.scale.set(1.1, 1.1, 1.1);
            setHoveredName(matched.name.toUpperCase());
            renderer.domElement.style.cursor = "pointer";
          }
        }
      } else {
        if (hoveredMesh) {
          hoveredMesh.parent?.scale.set(1.0, 1.0, 1.0);
          hoveredMesh = null;
          setHoveredName(null);
          renderer.domElement.style.cursor = "default";
        }
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (gameEndedRef.current) return;

      const coords = getMouseCoords(e);
      mouse.x = coords.x;
      mouse.y = coords.y;

      raycaster.setFromCamera(mouse, camera);
      const hitboxes = interactiveObjectsRef.current.map((o) => o.mesh);
      const intersects = raycaster.intersectObjects(hitboxes);

      if (intersects.length > 0) {
        const hitHitbox = intersects[0].object;
        const matched = interactiveObjectsRef.current.find((o) => o.mesh === hitHitbox);

        if (matched) {
          if (matched.id === "campfire") {
            if (!isGossipingRef.current) {
              showNotificationRef.current("GATHERING AROUND THE CAMPFIRE... GOSSIP PROTOCOL COMMENCING.", "success");
              handleAdvanceDayRef.current();
            }
          } else {
            setSelectedNpcId(matched.id);
            showNotificationRef.current(`WALKING TO ${matched.name.toUpperCase()}...`, "info");
          }
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("click", handleCanvasClick);

    // --- 14. Responsive Resize ---
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // --- 15. Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener("click", handleCanvasClick);
      }
      resizeObserver.disconnect();

      // Dispose resources
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      // Clear smoke
      smokeParticles.forEach((p) => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as any).dispose();
      });

      // Clear dust
      dustParticles.forEach((p) => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as any).dispose();
      });

      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px]">
      
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block rounded outline-none" />

      {/* Interactive Tooltip HUD Overlay */}
      {hoveredName && (
        <div
          className="absolute bg-black/95 text-amber-200 border-2 border-amber-400/80 px-2 py-1 text-[9px] font-mono rounded pointer-events-none shadow-[0_0_8px_rgba(245,158,11,0.5)] uppercase tracking-wider font-bold z-30"
          style={{
            left: `${hoveredPos.x}px`,
            top: `${hoveredPos.y}px`,
            transform: "translateX(-50%)",
          }}
        >
          {hoveredName}
        </div>
      )}

      {/* Legend & Controls overlay HUD card */}
      <div className="absolute bottom-2 left-2 right-2 md:right-auto bg-[#ebdcb9]/95 border-2 border-[#38251b] rounded p-2 flex items-center justify-between gap-3 shadow-lg pointer-events-auto z-20 max-w-sm">
        <div className="flex flex-col gap-0.5">
          <div className="text-[7.5px] font-mono font-bold text-[#855b32] uppercase tracking-wider">
            VIRTUAL VILLAGE SIMULATOR
          </div>
          <p className="text-[8px] text-[#4a3b2c] leading-none">
            Interact with houses to visit NPCs, or the campfire to sleep.
          </p>
        </div>
        
        {/* Sleeping indicator */}
        <div className="flex gap-1.5 shrink-0">
          <div className="flex items-center gap-1 bg-[#855b32]/10 border border-[#855b32]/40 rounded px-1.5 py-0.5">
            <Moon className="w-3 h-3 text-[#855b32]" />
            <span className="text-[7px] font-mono font-bold text-[#855b32] uppercase">
              {isGossiping ? "CAMPFIRE SLEEP IN PROGRESS" : "SLEEP / RESET"}
            </span>
          </div>
        </div>
      </div>

      {/* Help bubble link */}
      {helpModeActive && (
        <button
          type="button"
          onClick={() => setActiveHelpSection("villageMap")}
          className="absolute top-2 right-2 z-40 w-6 h-6 rounded-full bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 text-amber-100 flex items-center justify-center font-bold text-xs shadow-lg animate-bounce cursor-pointer"
          title="Click to learn about the 3D Village Map"
        >
          ?
        </button>
      )}

      {/* Retro CRT Grid scanline overlay for electronic matrix feel */}
      <div className="scanlines pointer-events-none rounded opacity-35" />
    </div>
  );
}
