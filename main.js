/* =============================================================================
   Terminal Systems — main.js
   ----------------------------------------------------------------------------
   - Three.js: builds a sunset warehouse yard with semi-trucks + ISO containers.
   - GSAP + ScrollTrigger: choreograph the camera through 5 scroll "acts" and
     fade/animate the text overlays.
   - Procedural geometry only (no external assets) so the file is self-contained
     and loads instantly.
============================================================================= */

import * as THREE from "three";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ----- Capability checks -------------------------------------------------- */
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const canvas = document.getElementById("bg-canvas");

/* =============================================================================
   1. RENDERER / SCENE / CAMERA
============================================================================= */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: window.devicePixelRatio < 2, // skip MSAA on hi-DPI for perf
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
// Warm sunset fog gives the yard atmospheric depth and hides the horizon seam.
scene.fog = new THREE.Fog(0xff7a3d, 60, 380);
scene.background = new THREE.Color(0x1a0d1d);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.5,
  900
);
camera.position.set(0, 6, 60);
camera.lookAt(0, 4, 0);

/* =============================================================================
   2. LIGHTING — sunset rig
============================================================================= */

// Hemisphere: warm sky over cool ground bounce
const hemi = new THREE.HemisphereLight(0xff9966, 0x1a0d2a, 0.55);
scene.add(hemi);

// The sun — low, warm, casts long shadows
const sun = new THREE.DirectionalLight(0xffb070, 2.4);
sun.position.set(-80, 28, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 260;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun);

// Cool fill from opposite side — keeps shadows from going pure black
const fill = new THREE.DirectionalLight(0x3a5a8a, 0.35);
fill.position.set(40, 20, 40);
scene.add(fill);

// Tiny accent rim light on the camera side
const rim = new THREE.PointLight(0xffaa66, 0.6, 80);
rim.position.set(0, 12, 30);
scene.add(rim);

/* =============================================================================
   3. SKY DOME — gradient backdrop with a glowing sun disc
============================================================================= */

{
  const skyGeo = new THREE.SphereGeometry(500, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1a0d3a) },
      midColor: { value: new THREE.Color(0xff5b2b) },
      botColor: { value: new THREE.Color(0xffd27d) },
      sunPos: { value: new THREE.Vector3(-0.35, 0.18, -0.92).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldDir;
      uniform vec3 topColor, midColor, botColor, sunPos;
      void main() {
        vec3 d = normalize(vWorldDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        // Two-stop gradient: bottom -> mid (horizon) -> top.
        vec3 col = mix(botColor, midColor, smoothstep(0.0, 0.35, h));
        col = mix(col, topColor, smoothstep(0.45, 0.95, h));
        // Glowing sun disc
        float s = max(dot(d, normalize(sunPos)), 0.0);
        col += vec3(1.0, 0.7, 0.45) * pow(s, 64.0) * 1.6;       // core
        col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.45;       // bloom
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

/* =============================================================================
   4. GROUND — asphalt yard with painted lanes
============================================================================= */

{
  // Procedural striped texture for parking lanes
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1f1e26";
  ctx.fillRect(0, 0, 1024, 1024);
  // subtle noise
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 1);
  }
  // lane lines
  ctx.fillStyle = "#ffb86a";
  for (let i = 0; i < 8; i++) {
    ctx.globalAlpha = 0.55;
    ctx.fillRect(120 + i * 110, 80, 6, 864);
  }
  ctx.globalAlpha = 1;
  // dashed center line
  ctx.fillStyle = "#fff2c4";
  for (let y = 60; y < 1000; y += 60) {
    ctx.fillRect(508, y, 8, 32);
  }

  const groundTex = new THREE.CanvasTexture(c);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(24, 24);
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  groundTex.colorSpace = THREE.SRGBColorSpace;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.92,
      metalness: 0.05,
      color: 0xb89070,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

/* =============================================================================
   5. SHIPPING CONTAINERS
============================================================================= */

/** Build one ISO-style shipping container at the given grid position. */
function makeContainer(color, length = 12) {
  const group = new THREE.Group();

  // Ridged side panels — use a slightly bumpy material via a procedural canvas
  const ridgeCanvas = document.createElement("canvas");
  ridgeCanvas.width = 512;
  ridgeCanvas.height = 64;
  const rctx = ridgeCanvas.getContext("2d");
  rctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  rctx.fillRect(0, 0, 512, 64);
  for (let x = 0; x < 512; x += 8) {
    rctx.fillStyle = "rgba(0,0,0,0.18)";
    rctx.fillRect(x, 0, 2, 64);
    rctx.fillStyle = "rgba(255,255,255,0.08)";
    rctx.fillRect(x + 2, 0, 2, 64);
  }
  // light weathering streaks
  for (let i = 0; i < 18; i++) {
    rctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
    const sx = Math.random() * 512;
    rctx.fillRect(sx, 4, 1, 56);
  }
  const ridgeTex = new THREE.CanvasTexture(ridgeCanvas);
  ridgeTex.wrapS = THREE.RepeatWrapping;
  ridgeTex.repeat.set(length / 2, 1);
  ridgeTex.colorSpace = THREE.SRGBColorSpace;

  const sideMat = new THREE.MeshStandardMaterial({
    map: ridgeTex,
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.35,
  });
  const endMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.35,
  });

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(length, 2.6, 2.4),
    [endMat, endMat, sideMat, sideMat, sideMat, sideMat] // (px, nx, py, ny, pz, nz)
  );
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // Corner castings — small darker cubes at each corner
  const castMat = new THREE.MeshStandardMaterial({
    color: 0x222227,
    roughness: 0.5,
    metalness: 0.6,
  });
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sy) => {
      [-1, 1].forEach((sz) => {
        const cast = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.4, 0.4),
          castMat
        );
        cast.position.set(
          (length / 2 - 0.2) * sx,
          (1.3 - 0.2) * sy,
          (1.2 - 0.2) * sz
        );
        cast.castShadow = true;
        group.add(cast);
      });
    });
  });

  group.position.y = 1.3;
  return group;
}

// Container yard — two long rows behind the camera-facing trucks, plus a
// stack to give the scene vertical depth.
const containerColors = [
  0xc14a3a, 0x2b6e8a, 0xc2a23a, 0x4a8a3a, 0x8a4aa6, 0xb3552d, 0x2a5a72,
];
const containerYard = new THREE.Group();
scene.add(containerYard);

for (let row = 0; row < 5; row++) {
  for (let i = 0; i < 9; i++) {
    const len = Math.random() > 0.4 ? 12 : 6;
    const c = makeContainer(
      containerColors[(row + i) % containerColors.length],
      len
    );
    c.position.set(-44 + i * 11, 1.3, -50 - row * 4.5);
    if (row === 0 && Math.random() > 0.55) {
      // stack a second container on top occasionally
      const top = makeContainer(
        containerColors[(row + i + 3) % containerColors.length],
        len
      );
      top.position.set(0, 2.7, 0);
      c.add(top);
    }
    c.rotation.y = (Math.random() - 0.5) * 0.04;
    containerYard.add(c);
  }
}

/* =============================================================================
   6. SEMI-TRUCKS
============================================================================= */

/** Build one Class-8 style semi-truck (tractor + trailer). */
function makeTruck({ cabColor = 0xffffff, trailerColor = 0xf0eee8 } = {}) {
  const truck = new THREE.Group();

  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1a20,
    roughness: 0.6,
    metalness: 0.5,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd8d8e0,
    roughness: 0.25,
    metalness: 0.9,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1f2a3a,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7,
  });
  const cab = new THREE.MeshStandardMaterial({
    color: cabColor,
    roughness: 0.45,
    metalness: 0.55,
  });
  const trailerMat = new THREE.MeshStandardMaterial({
    color: trailerColor,
    roughness: 0.55,
    metalness: 0.4,
  });

  /* ----- Tractor (cab) ----- */
  const tractor = new THREE.Group();

  // Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 2.3), cab);
  hood.position.set(2.6, 1.6, 0);
  hood.castShadow = true;
  tractor.add(hood);

  // Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 2.1), dark);
  grille.position.set(4.4, 1.55, 0);
  tractor.add(grille);

  // Bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 2.5), chrome);
  bumper.position.set(4.55, 0.85, 0);
  tractor.add(bumper);

  // Sleeper cab (taller box behind hood)
  const sleeper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 2.3), cab);
  sleeper.position.set(0.2, 2.25, 0);
  sleeper.castShadow = true;
  tractor.add(sleeper);

  // Windshield — wedge cut on top of the hood
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 2.05),
    glass
  );
  windshield.position.set(1.6, 2.45, 0);
  windshield.rotation.z = -0.35;
  tractor.add(windshield);

  // Side windows
  [-1, 1].forEach((sz) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 0.05), glass);
    w.position.set(0.3, 2.45, sz * 1.18);
    tractor.add(w);
  });

  // Exhaust stacks
  [-1, 1].forEach((sz) => {
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 3.2, 12),
      chrome
    );
    stack.position.set(-0.9, 3.2, sz * 1.05);
    stack.castShadow = true;
    tractor.add(stack);
  });

  // Headlights
  [-1, 1].forEach((sz) => {
    const h = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c4,
        emissive: 0xffd27d,
        emissiveIntensity: 1.8,
      })
    );
    h.rotation.z = Math.PI / 2;
    h.position.set(4.45, 1.7, sz * 0.75);
    tractor.add(h);
  });

  // Wheels (front + rear of tractor)
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 18);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x14141a,
    roughness: 0.85,
    metalness: 0.2,
  });
  function wheelAt(x, z) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.7, z);
    w.castShadow = true;
    return w;
  }
  [-1, 1].forEach((sz) => {
    tractor.add(wheelAt(3.5, sz * 1.25)); // front
    tractor.add(wheelAt(-1.0, sz * 1.25)); // mid
    tractor.add(wheelAt(0.0, sz * 1.25)); // rear-mid
  });

  truck.add(tractor);

  /* ----- Trailer ----- */
  const trailer = new THREE.Group();
  const tbox = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 2.5), trailerMat);
  tbox.position.set(-9, 2.6, 0);
  tbox.castShadow = true;
  tbox.receiveShadow = true;
  trailer.add(tbox);

  // Logo panel
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.2),
    new THREE.MeshBasicMaterial({
      color: 0xff7a3d,
      transparent: true,
      opacity: 0.92,
    })
  );
  logo.position.set(-9, 2.6, 1.27);
  trailer.add(logo);

  // Trailer wheels (3 axles)
  for (let i = 0; i < 3; i++) {
    [-1, 1].forEach((sz) => {
      trailer.add(wheelAt(-14 + i * 1.3, sz * 1.25));
    });
  }

  // Landing gear stubs (just visual)
  [-1, 1].forEach((sz) => {
    const gear = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 1.0, 0.25),
      chrome
    );
    gear.position.set(-3.5, 0.5, sz * 0.9);
    trailer.add(gear);
  });

  truck.add(trailer);

  return truck;
}

// A short line of trucks staggered in depth — the camera will fly along them.
const truckLine = new THREE.Group();
scene.add(truckLine);

const truckSpecs = [
  { cabColor: 0xff7a3d, trailerColor: 0xf3eee4, x: -18, z: -8 },
  { cabColor: 0x2b6e8a, trailerColor: 0xf3eee4, x: 4, z: -14 },
  { cabColor: 0xc14a3a, trailerColor: 0xe9e2d3, x: 28, z: -10 },
  { cabColor: 0x2a2a30, trailerColor: 0xff7a3d, x: -42, z: -20 },
  { cabColor: 0xd9bf6a, trailerColor: 0xf3eee4, x: 50, z: -26 },
];

truckSpecs.forEach((s) => {
  const t = makeTruck({ cabColor: s.cabColor, trailerColor: s.trailerColor });
  t.position.set(s.x, 0, s.z);
  t.rotation.y = Math.PI / 2; // face the camera path
  truckLine.add(t);
});

// One "hero" truck closer to the camera in the foreground for the fleet act
const heroTruck = makeTruck({ cabColor: 0xff7a3d, trailerColor: 0x0f0f15 });
heroTruck.position.set(-6, 0, 22);
heroTruck.rotation.y = Math.PI / 2 + 0.18;
scene.add(heroTruck);

/* =============================================================================
   7. WAREHOUSE BUILDINGS (silhouettes far back)
============================================================================= */

{
  const wMat = new THREE.MeshStandardMaterial({
    color: 0x2a1f2e,
    roughness: 0.95,
    metalness: 0.1,
  });
  for (let i = -6; i <= 6; i++) {
    const w = i % 2 === 0 ? 40 : 28;
    const h = 14 + Math.random() * 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 22), wMat);
    b.position.set(i * 36, h / 2, -130);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);

    // Roof "ridge"
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.6, 22.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1320, roughness: 0.9 })
    );
    ridge.position.set(i * 36, h + 0.3, -130);
    scene.add(ridge);
  }

  // Stadium-style yard lights on tall poles
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22,
    roughness: 0.7,
    metalness: 0.4,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c4,
    emissive: 0xffd27d,
    emissiveIntensity: 1.4,
  });
  [-60, -20, 20, 60].forEach((x) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 22, 8),
      poleMat
    );
    pole.position.set(x, 11, -90);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1.2), lampMat);
    lamp.position.set(x, 22, -89.2);
    scene.add(lamp);
  });
}

/* =============================================================================
   8. WIREFRAME AI ELEMENTS
   These start invisible and fade in during the "intelligence" act.
============================================================================= */

const aiGroup = new THREE.Group();
aiGroup.visible = true;
scene.add(aiGroup);

const wireMat = new THREE.LineBasicMaterial({
  color: 0x6bd4ff,
  transparent: true,
  opacity: 0,
});
const wireMatWarm = new THREE.LineBasicMaterial({
  color: 0xff7a3d,
  transparent: true,
  opacity: 0,
});

// Big icosahedron overhead — the "model"
{
  const geo = new THREE.IcosahedronGeometry(7, 1);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    wireMat.clone()
  );
  wire.position.set(0, 18, -10);
  aiGroup.add(wire);

  // inner counter-rotating
  const inner = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4.5, 0)),
    wireMatWarm.clone()
  );
  inner.position.copy(wire.position);
  aiGroup.add(inner);

  aiGroup.userData.icoOuter = wire;
  aiGroup.userData.icoInner = inner;
}

// Floating data nodes connected by lines (a sparse graph)
{
  const nodes = [];
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0x6bd4ff,
    transparent: true,
    opacity: 0,
  });
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      nodeMat.clone()
    );
    m.position.set(
      (Math.random() - 0.5) * 70,
      4 + Math.random() * 22,
      -40 + (Math.random() - 0.5) * 60
    );
    aiGroup.add(m);
    nodes.push(m);
  }
  // connect nearest neighbours
  const positions = [];
  for (let i = 0; i < nodes.length; i++) {
    let nearest = -1;
    let bestDist = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const d = nodes[i].position.distanceTo(nodes[j].position);
      if (d < bestDist && d < 20) {
        bestDist = d;
        nearest = j;
      }
    }
    if (nearest >= 0) {
      positions.push(...nodes[i].position.toArray());
      positions.push(...nodes[nearest].position.toArray());
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  const graph = new THREE.LineSegments(lineGeo, wireMat.clone());
  aiGroup.add(graph);
  aiGroup.userData.nodes = nodes;
  aiGroup.userData.graph = graph;
}

// HUD-style scanning ring on the ground
{
  const ringGeo = new THREE.RingGeometry(8, 8.15, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x6bd4ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-6, 0.05, 22);
  aiGroup.add(ring);
  aiGroup.userData.ring = ring;
}

/* Helper to fade the entire AI group in/out */
function setAiOpacity(t) {
  // t in [0,1]
  aiGroup.traverse((obj) => {
    if (obj.material && "opacity" in obj.material) {
      const peak = obj.material === wireMatWarm ? 0.95 : 0.85;
      obj.material.opacity = t * peak;
    }
  });
}

/* =============================================================================
   9. DUST PARTICLES — adds atmosphere & motion to the air
============================================================================= */

{
  const N = 260;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = Math.random() * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160 - 20;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({
    color: 0xffd0a0,
    size: 0.12,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const dust = new THREE.Points(g, m);
  scene.add(dust);
  scene.userData.dust = dust;
}

/* =============================================================================
   10. CAMERA PATH — KEYFRAMES PER ACT
============================================================================= */

// Each scene-section maps to one camera keyframe. ScrollTrigger interpolates
// between consecutive keyframes as the user scrolls.
const keyframes = [
  // 0: HERO — wide establishing shot looking down the truck line
  {
    pos: new THREE.Vector3(0, 8, 60),
    look: new THREE.Vector3(0, 5, 0),
    fov: 42,
  },
  // 1: MARKETS — pull right and down, lower angle along the trucks
  {
    pos: new THREE.Vector3(32, 4.5, 30),
    look: new THREE.Vector3(-10, 3.5, -10),
    fov: 38,
  },
  // 2: FLEET — very close to the hero truck, side profile
  {
    pos: new THREE.Vector3(-1, 3.2, 14),
    look: new THREE.Vector3(-6, 2.6, 22),
    fov: 34,
  },
  // 3: INTELLIGENCE — rise up, dolly back, look at the AI icosahedron
  {
    pos: new THREE.Vector3(0, 22, 38),
    look: new THREE.Vector3(0, 16, -10),
    fov: 48,
  },
  // 4: CONTACT — wide skyward pullback
  {
    pos: new THREE.Vector3(8, 36, 90),
    look: new THREE.Vector3(0, 8, -40),
    fov: 55,
  },
];

// Holders we mutate every frame
const camTarget = {
  pos: keyframes[0].pos.clone(),
  look: keyframes[0].look.clone(),
  fov: keyframes[0].fov,
};

/* =============================================================================
   11. SCROLL-DRIVEN CAMERA + AI VISIBILITY
============================================================================= */

const sections = Array.from(document.querySelectorAll(".scene-section"));

// One master timeline driven by total page scroll. We compute a normalized
// scroll-progress value [0..1] and map it into the keyframe array.
const scrollState = { progress: 0 };

ScrollTrigger.create({
  trigger: document.body,
  start: "top top",
  end: "bottom bottom",
  scrub: prefersReducedMotion ? false : 0.6,
  onUpdate: (self) => {
    scrollState.progress = self.progress;
    // update the top scroll progress bar
    document.querySelector(".scroll-progress-bar").style.width =
      (self.progress * 100).toFixed(2) + "%";
  },
});

// AI overlay fade: visible 60%-90% scroll (intelligence act window)
ScrollTrigger.create({
  trigger: "#intelligence",
  start: "top bottom",
  end: "bottom top",
  scrub: true,
  onUpdate: (self) => {
    // smooth bell curve so it fades in mid-section then fades out
    const p = self.progress;
    const bell = Math.sin(Math.PI * p);
    setAiOpacity(Math.min(1, Math.max(0, bell)));
  },
});

/* =============================================================================
   12. TEXT REVEAL ANIMATIONS
============================================================================= */

sections.forEach((sec) => {
  const items = sec.querySelectorAll(".reveal");
  if (!items.length) return;
  gsap.to(items, {
    opacity: 1,
    y: 0,
    duration: prefersReducedMotion ? 0.01 : 0.9,
    ease: "power3.out",
    stagger: prefersReducedMotion ? 0 : 0.08,
    scrollTrigger: {
      trigger: sec,
      start: "top 78%",
      toggleActions: "play none none reverse",
    },
  });
});

// Counter-up for stat numbers
document.querySelectorAll(".stat-num").forEach((el) => {
  const end = Number(el.dataset.count || el.textContent);
  const obj = { v: 0 };
  gsap.to(obj, {
    v: end,
    duration: 1.6,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 85%" },
    onUpdate: () => {
      el.textContent = Math.round(obj.v).toLocaleString();
    },
  });
});

// Nav background darkens after the first viewport
ScrollTrigger.create({
  start: "top -80",
  end: 99999,
  toggleClass: { className: "nav-scrolled", targets: ".nav" },
});

/* =============================================================================
   13. RENDER LOOP
============================================================================= */

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const clock = new THREE.Clock();

function lerpKeyframes(t) {
  // t is in [0,1] across the whole page. Distribute over keyframes.
  const segments = keyframes.length - 1;
  const scaled = t * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  // ease the local segment t for a smoother cinematic feel
  const local = scaled - i;
  const eased = local * local * (3 - 2 * local); // smoothstep

  const a = keyframes[i];
  const b = keyframes[i + 1];

  camTarget.pos.lerpVectors(a.pos, b.pos, eased);
  camTarget.look.lerpVectors(a.look, b.look, eased);
  camTarget.fov = a.fov + (b.fov - a.fov) * eased;
}

function animate() {
  const dt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  lerpKeyframes(scrollState.progress);

  // Tiny lazy easing toward the keyframe-derived target (extra smoothness)
  camera.position.lerp(camTarget.pos, 1 - Math.pow(0.001, dt));
  tmpLook.copy(camTarget.look);
  // Subtle handheld float so the camera never feels locked
  tmpLook.x += Math.sin(elapsed * 0.4) * 0.08;
  tmpLook.y += Math.cos(elapsed * 0.3) * 0.05;
  camera.lookAt(tmpLook);

  if (Math.abs(camera.fov - camTarget.fov) > 0.01) {
    camera.fov += (camTarget.fov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
  }

  // Spin the AI primitives
  if (aiGroup.userData.icoOuter) {
    aiGroup.userData.icoOuter.rotation.y += dt * 0.15;
    aiGroup.userData.icoOuter.rotation.x += dt * 0.05;
    aiGroup.userData.icoInner.rotation.y -= dt * 0.32;
    aiGroup.userData.icoInner.rotation.z += dt * 0.18;
    aiGroup.userData.ring.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.15);
  }

  // Drift the dust
  const dust = scene.userData.dust;
  if (dust) {
    const arr = dust.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += dt * 0.4 * (0.4 + (i % 7) / 14);
      if (arr[i + 1] > 24) arr[i + 1] = 0;
    }
    dust.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

/* =============================================================================
   14. 2D PARALLAX LAYERS (sun, haze)
============================================================================= */

const parallaxLayers = document.querySelectorAll(".parallax-layer");

function updateParallax() {
  const y = window.scrollY;
  parallaxLayers.forEach((el) => {
    const depth = parseFloat(el.dataset.depth || "0");
    if (!depth) return;
    el.style.transform = `translate3d(0, ${-y * depth}px, 0)`;
  });
}
window.addEventListener("scroll", updateParallax, { passive: true });
updateParallax();

/* =============================================================================
   15. RESPONSIVE / RESIZE
============================================================================= */

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ScrollTrigger.refresh();
}
window.addEventListener("resize", onResize);

/* =============================================================================
   16. PAUSE WHEN HIDDEN (perf)
============================================================================= */

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    renderer.setAnimationLoop(null);
  } else {
    clock.start();
  }
});

/* =============================================================================
   17. MOBILE NAV — burger toggles nav-links visibility on small screens
============================================================================= */

const burger = document.querySelector(".nav-burger");
const navLinks = document.querySelector(".nav-links");
burger?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navLinks.style.display = open ? "flex" : "";
  navLinks.style.position = open ? "absolute" : "";
  navLinks.style.top = open ? "100%" : "";
  navLinks.style.right = open ? "0" : "";
  navLinks.style.flexDirection = open ? "column" : "";
  navLinks.style.background = open ? "rgba(10,10,15,0.96)" : "";
  navLinks.style.padding = open ? "18px 24px" : "";
  navLinks.style.borderRadius = open ? "0 0 12px 12px" : "";
});
navLinks?.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    if (navLinks.classList.contains("open")) burger.click();
  })
);
