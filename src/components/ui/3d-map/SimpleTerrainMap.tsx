import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

declare global {
  interface Window {
    __terrainColorCanvas?: HTMLCanvasElement;
    __terrainColorDataUrl?: string;
    __terrainMaterial?: THREE.MeshLambertMaterial;
  }
}

// Heightmap aspect ratio (px) to keep north/south scaling accurate
const HEIGHTMAP_WIDTH_PX = 1517;
const HEIGHTMAP_HEIGHT_PX = 1119;
const HEIGHTMAP_ASPECT = HEIGHTMAP_HEIGHT_PX / HEIGHTMAP_WIDTH_PX;

// Simple terrain dimensions sized for the cropped map
const TERRAIN_WIDTH = 60;
const TERRAIN_HEIGHT = TERRAIN_WIDTH * HEIGHTMAP_ASPECT;
const HEIGHT_SCALE = 0.8;

type Town = {
  id: string;
  name: string;
  badge: string | null;
  x: number;
  z: number;
  address: string;
  phone: string;
  email: string | null;
  services: readonly string[];
  description: string;
};

const towns: readonly Town[] = [
  {
    id: 'gillette',
    name: 'Gillette, WY',
    badge: 'HEADQUARTERS',
    x: -7.6,
    z: -2.9,
    address: '3106 East 2nd Street<br/>Gillette, WY 82716',
    phone: '307-682-0143',
    email: null,
    services: ['Cased Hole Wireline', 'Open Hole Wireline', 'Pipe Recovery', 'Gyroscopic Survey', 'TCP', 'CCL'],
    description: 'Primary operations base serving the Powder River Basin',
  },
  {
    id: 'casper',
    name: 'Casper, WY',
    badge: null,
    x: -8.0,
    z: -1.5,
    address: '2384 Mine Rd<br/>Casper, WY 82604',
    phone: '307-262-3055',
    email: null,
    services: ['Cased Hole Wireline', 'Open Hole Wireline', 'Pipe Recovery', 'TCP'],
    description: 'Serving operators in the DJ Basin',
  },
  {
    id: 'dickinson',
    name: 'Dickinson, ND',
    badge: null,
    x: -6.2,
    z: -6.5,
    address: '2780 East Villard<br/>Dickinson, ND 58601',
    phone: '701-590-9750',
    email: null,
    services: ['Cased Hole Wireline', 'Open Hole Wireline', 'TCP', 'Pipe Recovery'],
    description: 'Full-service operations in the Williston Basin',
  },
  {
    id: 'williston',
    name: 'Williston, ND',
    badge: null,
    x: -5.8,
    z: -7.3,
    address: '922 5th St. East<br/>Williston, ND 58801',
    phone: '701-580-2130',
    email: null,
    services: ['Cased Hole Wireline', 'Open Hole Wireline', 'TCP', 'Gyroscopic Survey'],
    description: 'Ready to deliver results in the Bakken',
  },
] as const;

// Gillette coordinates: x: -7.6, z: -2.9
// Camera positioned south-southeast at shallow angle: Cheyenne foreground, Gillette center, Williston top-right
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(-7.6 + 4, 4, -2.9 + 8);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(-7.6 - 1, 1, -2.9 - 4);

// Store heightmap globally
let heightmapData: ImageData | null = null;
let heightmapStats = { min: 0, max: 255 };

// Get terrain height at position
function getHeight(x: number, z: number): number {
  if (!heightmapData) return 0.5;

  // Convert world position to image coordinates
  const u = (x + TERRAIN_WIDTH / 2) / TERRAIN_WIDTH;
  const v = (z + TERRAIN_HEIGHT / 2) / TERRAIN_HEIGHT;

  const imgX = Math.floor(u * heightmapData.width);
  const imgY = Math.floor(v * heightmapData.height);

  const safeX = Math.max(0, Math.min(heightmapData.width - 1, imgX));
  const safeY = Math.max(0, Math.min(heightmapData.height - 1, imgY));

  const pixelIndex = (safeY * heightmapData.width + safeX) * 4;
  const brightness = heightmapData.data[pixelIndex];
  const range = heightmapStats.max - heightmapStats.min || 1;
  const normalized = THREE.MathUtils.clamp((brightness - heightmapStats.min) / range, 0, 1);

  return normalized * HEIGHT_SCALE;
}

// Terrain mesh with heightmap texture
function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/heightmap-north-america-cropped.png?v=${Math.random()}`;

    img.onload = () => {
      if (!meshRef.current) return;

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      heightmapData = ctx.getImageData(0, 0, img.width, img.height);
      let min = 255;
      let max = 0;
      for (let i = 0; i < heightmapData.data.length; i += 4) {
        const value = heightmapData.data[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      heightmapStats = { min, max };

      console.log('✅ Heightmap loaded:', img.width, 'x', img.height);
      console.log('📈 Heightmap range:', min, 'to', max);

      // Create colorized texture from heightmap
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = img.width;
      colorCanvas.height = img.height;
      const colorCtx = colorCanvas.getContext('2d');
      if (!colorCtx) return;

      // Draw heightmap
      colorCtx.drawImage(img, 0, 0);
      const imageData = colorCtx.getImageData(0, 0, img.width, img.height);

      // Single color for the entire terrain
      const terrainColor = new THREE.Color('#6B5D4F');

      // Colorize based on elevation with contrast boost
      const { width, height } = imageData;
      const tmpColor = new THREE.Color();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;

          // Use single color for entire terrain
          tmpColor.copy(terrainColor);

          // Simple slope-based shading for subtle depth
          const leftIdx = (y * width + Math.max(x - 1, 0)) * 4;
          const rightIdx = (y * width + Math.min(x + 1, width - 1)) * 4;
          const upIdx = (Math.max(y - 1, 0) * width + x) * 4;
          const downIdx = (Math.min(y + 1, height - 1) * width + x) * 4;

          const dx = (heightmapData.data[rightIdx] - heightmapData.data[leftIdx]) / 255;
          const dy = (heightmapData.data[downIdx] - heightmapData.data[upIdx]) / 255;

          const slope = Math.sqrt(dx * dx + dy * dy);
          const shade = THREE.MathUtils.clamp(1.0 - slope * 0.3, 0.7, 1.3);

          const r = THREE.MathUtils.clamp(tmpColor.r * 255 * shade, 0, 255);
          const g = THREE.MathUtils.clamp(tmpColor.g * 255 * shade, 0, 255);
          const b = THREE.MathUtils.clamp(tmpColor.b * 255 * shade, 0, 255);

          imageData.data[idx] = Math.round(r);
          imageData.data[idx + 1] = Math.round(g);
          imageData.data[idx + 2] = Math.round(b);
        }
      }

      colorCtx.putImageData(imageData, 0, 0);
      console.log('🎨 Colorized sample:', imageData.data[0], imageData.data[1], imageData.data[2]);
      console.log('✅ Colorized texture created');
      const topLeft = colorCtx.getImageData(0, 0, 1, 1).data;
      console.log('🧪 Canvas top-left pixel:', topLeft[0], topLeft[1], topLeft[2]);

      const texture = new THREE.CanvasTexture(colorCanvas);
      if (typeof window !== 'undefined') {
        window.__terrainColorCanvas = colorCanvas;
        window.__terrainColorDataUrl = colorCanvas.toDataURL('image/png');
        console.log('🧪 Debug texture URL preview:', window.__terrainColorDataUrl.slice(0, 80), '...');
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.flipY = false; // THREE.js flips textures by default, we want it NOT flipped
      texture.anisotropy = 8;
      texture.needsUpdate = true;

      console.log('🎨 Texture created:', texture);
      console.log('📊 Canvas dimensions:', colorCanvas.width, 'x', colorCanvas.height);

      // Don't apply the texture - we're using solid color instead
      // setHeightTexture(texture);

      // Apply heights to terrain geometry
      const geometry = meshRef.current.geometry as THREE.PlaneGeometry;
      const positionAttr = geometry.getAttribute('position');

      for (let i = 0; i < positionAttr.count; i++) {
        const x = positionAttr.getX(i);
        const planeY = positionAttr.getY(i);
        const worldZ = -planeY; // plane is rotated -90° around X, so local +Y maps to world -Z

        const height = getHeight(x, worldZ);
        positionAttr.setZ(i, height);
      }

      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    };
  }, []);

  return (
    <>
      {/* Main terrain with solid color */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <planeGeometry args={[TERRAIN_WIDTH, TERRAIN_HEIGHT, 300, 200]} />
        <meshStandardMaterial color="#6B5545" roughness={1.0} metalness={0.0} />
      </mesh>
    </>
  );
}

// Basin overlay regions with polygon boundaries
// Each basin defined by lat/lon polygon points (clockwise from northwest)
const basins = [
  {
    name: 'Powder River Basin',
    color: '#FF6B35', // Orange-red
    opacity: 0.15,
    // Polygon points approximating the basin boundary (bounded by Bighorn Mtns, Black Hills, Casper Arch, Hartville Uplift)
    polygon: [
      [-106.5, 45.5], // NW corner
      [-106.0, 46.5], // N (SE Montana)
      [-105.5, 46.8],
      [-105.0, 46.5],
      [-104.5, 45.5], // NE (approaching Black Hills)
      [-104.3, 44.5],
      [-104.5, 43.5], // E side
      [-105.0, 43.0], // SE (Hartville Uplift area)
      [-105.5, 42.8],
      [-106.5, 43.0], // S (Casper Arch)
      [-107.0, 43.5],
      [-107.2, 44.5], // W (Bighorn Mtns)
      [-107.0, 45.0],
    ],
  },
  {
    name: 'Bighorn Basin',
    color: '#F38181', // Coral pink
    opacity: 0.15,
    // Oval-shaped NW-SE trending basin (bounded by Absaroka, Pryor, Bighorn, Owl Creek Mtns)
    polygon: [
      [-109.2, 45.3], // NW
      [-108.5, 45.5], // N (Pryor Mtns)
      [-108.0, 45.3],
      [-107.5, 44.8], // NE approaching Bighorn Mtns
      [-107.3, 44.2],
      [-107.5, 43.8], // SE (Owl Creek Mtns)
      [-108.0, 43.6],
      [-108.8, 43.7], // S (Bridger Mtns)
      [-109.5, 44.0],
      [-109.8, 44.5], // W (Absaroka Range)
      [-109.6, 45.0],
    ],
  },
  {
    name: 'DJ Basin',
    color: '#4ECDC4', // Turquoise
    opacity: 0.15,
    // Elongated N-S basin in SE Wyoming and NE Colorado
    polygon: [
      [-105.5, 42.5], // N (Wyoming)
      [-104.5, 42.8],
      [-104.0, 42.5],
      [-103.5, 42.0], // NE
      [-103.3, 41.0],
      [-103.5, 40.0], // E (Colorado/Kansas border)
      [-104.0, 39.8],
      [-105.0, 40.0], // S (Front Range)
      [-105.5, 40.5],
      [-106.0, 41.0], // W (Laramie Range)
      [-106.0, 41.8],
      [-105.8, 42.2],
    ],
  },
  {
    name: 'Williston Basin',
    color: '#95E1D3', // Mint green
    opacity: 0.15,
    // Large oval basin extending into Canada
    polygon: [
      [-105.5, 50.5], // NW (Saskatchewan)
      [-104.0, 51.0], // N
      [-102.0, 51.0],
      [-100.5, 50.5], // NE (Manitoba)
      [-100.0, 49.5],
      [-99.8, 48.0], // E
      [-100.2, 46.5],
      [-101.0, 45.8], // SE (SD)
      [-102.5, 45.8],
      [-104.0, 46.0], // S (MT)
      [-105.0, 46.5],
      [-106.0, 47.5], // SW
      [-106.0, 49.0],
      [-105.8, 50.0], // W
    ],
  },
  {
    name: 'Bakken Formation',
    color: '#AAD9CD', // Light seafoam
    opacity: 0.18,
    // Core Bakken play area (subset of Williston Basin)
    polygon: [
      [-104.5, 49.0], // NW
      [-103.0, 49.3], // N
      [-101.8, 49.0],
      [-101.5, 48.5], // NE
      [-101.3, 47.5], // E
      [-101.8, 47.0],
      [-103.0, 47.0], // S
      [-104.0, 47.2],
      [-104.5, 47.8], // SW
      [-104.7, 48.5], // W
    ],
  },
] as const;

// Individual basin overlay mesh component
function BasinMesh({ basin }: { basin: (typeof basins)[number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    // Lat/Lon bounds for North America view
    const minLat = 22;
    const maxLat = 61.5;
    const minLon = -136;
    const maxLon = -53.5;

    // Convert lat/lon to terrain coordinates
    const latLonToTerrain = (lon: number, lat: number) => {
      const x = ((lon - minLon) / (maxLon - minLon)) * TERRAIN_WIDTH - TERRAIN_WIDTH / 2;
      const z = ((lat - minLat) / (maxLat - minLat)) * TERRAIN_HEIGHT - TERRAIN_HEIGHT / 2;
      return { x, z: -z };
    };

    // Convert polygon lat/lon points to terrain coordinates
    const terrainPoints = basin.polygon.map(([lon, lat]) => latLonToTerrain(lon, lat));

    // Create a shape from the polygon points
    const shape = new THREE.Shape();
    terrainPoints.forEach((point, i) => {
      if (i === 0) {
        shape.moveTo(point.x, point.z);
      } else {
        shape.lineTo(point.x, point.z);
      }
    });
    shape.closePath();

    // Create geometry and apply to mesh
    const geometry = new THREE.ShapeGeometry(shape);
    meshRef.current.geometry = geometry;

    return () => {
      geometry.dispose();
    };
  }, [basin]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <shapeGeometry />
      <meshBasicMaterial color={basin.color} transparent opacity={basin.opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Basin overlays component
function BasinOverlays() {
  return (
    <group>
      {basins.map((basin) => (
        <BasinMesh key={basin.name} basin={basin} />
      ))}
    </group>
  );
}

// State border lines from GeoJSON
function StateBorders() {
  const [borderGeometries, setBorderGeometries] = useState<THREE.BufferGeometry[]>([]);

  useEffect(() => {
    fetch('/us-states.geojson')
      .then((res) => res.json())
      .then((geojson) => {
        const geometries: THREE.BufferGeometry[] = [];

        // Lat/Lon bounds for North America view including Pacific and Canada
        const minLat = 22; // Southern Mexico/Caribbean
        const maxLat = 61.5; // Northern Canada
        const minLon = -136; // Pacific Ocean
        const maxLon = -53.5; // Atlantic Ocean

        // Convert lat/lon to terrain coordinates
        const latLonToTerrain = (lon: number, lat: number) => {
          const x = ((lon - minLon) / (maxLon - minLon)) * TERRAIN_WIDTH - TERRAIN_WIDTH / 2;
          const z = ((lat - minLat) / (maxLat - minLat)) * TERRAIN_HEIGHT - TERRAIN_HEIGHT / 2;
          // Flip Z because latitude increases north but Z increases south in the map
          return { x, z: -z };
        };

        geojson.features.forEach(
          (feature: { properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }) => {
            // Skip Alaska and Hawaii
            const stateName = feature.properties?.name;
            if (stateName === 'Alaska' || stateName === 'Hawaii') {
              return;
            }

            const processCoordinates = (coords: unknown): void => {
              if (!Array.isArray(coords) || coords.length === 0) return;

              if (Array.isArray(coords[0])) {
                if (typeof coords[0][0] === 'number') {
                  // This is a line of coordinates
                  const points: THREE.Vector3[] = [];
                  (coords as [number, number][]).forEach(([lon, lat]) => {
                    const { x, z } = latLonToTerrain(lon, lat);
                    const y = getHeight(x, z) + 0.08;
                    points.push(new THREE.Vector3(x, y, z));
                  });
                  if (points.length > 1) {
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    geometries.push(geometry);
                  }
                } else {
                  // This is a polygon or multipolygon, recurse
                  coords.forEach((subCoords: unknown) => processCoordinates(subCoords));
                }
              }
            };

            if (feature.geometry.type === 'Polygon') {
              processCoordinates(feature.geometry.coordinates);
            } else if (feature.geometry.type === 'MultiPolygon') {
              (feature.geometry.coordinates as unknown[]).forEach((polygon: unknown) => {
                processCoordinates(polygon);
              });
            }
          }
        );

        setBorderGeometries(geometries);
      });
  }, []);

  return (
    <group>
      {borderGeometries.map((geometry, i) => (
        <line key={i}>
          <bufferGeometry attach="geometry" {...geometry} />
          <lineBasicMaterial color="#808080" linewidth={1} opacity={0.4} transparent />
        </line>
      ))}
    </group>
  );
}

// Town marker
function TownMarker({ town, isActive, onClick }: { town: Town; isActive: boolean; onClick: () => void }) {
  const markerRef = useRef<THREE.Group>(null);
  const [height, setHeight] = useState(0.5);

  useEffect(() => {
    const checkHeight = () => {
      const h = getHeight(town.x, town.z);
      setHeight(h);
    };
    checkHeight();
    const interval = setInterval(checkHeight, 100);
    setTimeout(() => clearInterval(interval), 2000);
    return () => clearInterval(interval);
  }, [town.x, town.z]);

  useFrame((state) => {
    if (markerRef.current) {
      markerRef.current.position.y = height + Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.5;
    }
  });

  return (
    <group ref={markerRef} position={[town.x, height + 0.5, town.z]} onClick={onClick}>
      {/* Glowing sphere - SMALLER */}
      <mesh>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial
          color="#C0C0C0"
          emissive="#C0C0C0"
          emissiveIntensity={isActive ? 2.5 : 1.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Light */}
      <pointLight color="#C0C0C0" intensity={isActive ? 6 : 3} distance={12} />

      {/* Label */}
      <Html position={[0, 1, 0]} center zIndexRange={[0, 0]}>
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            border: '2px solid #C0C0C0',
            boxShadow: '0 4px 20px rgba(192, 192, 192, 0.5)',
            pointerEvents: 'none',
          }}
        >
          {town.name}
        </div>
      </Html>
    </group>
  );
}

// Camera rig with orbit controls and smooth fly-to-town animation
function CameraRig({
  activeTown,
  onInteractionStart,
  controlsEnabled,
}: {
  activeTown: Town | null;
  onInteractionStart: () => void;
  controlsEnabled: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const animation = useRef({
    isAnimating: false,
    progress: 0,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    camera.position.copy(DEFAULT_CAMERA_POSITION);
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.update();
  }, [camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    animation.current.startPos.copy(camera.position);
    animation.current.startTarget.copy(controls.target);

    if (activeTown) {
      const h = getHeight(activeTown.x, activeTown.z);
      animation.current.endPos.set(activeTown.x - 3.5, h + 2.5, activeTown.z - 3.5);
      animation.current.endTarget.set(activeTown.x, h + 0.5, activeTown.z);
    } else {
      animation.current.endPos.copy(DEFAULT_CAMERA_POSITION);
      animation.current.endTarget.copy(DEFAULT_CAMERA_TARGET);
    }

    animation.current.progress = 0;
    animation.current.isAnimating = true;
  }, [activeTown, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (animation.current.isAnimating) {
      animation.current.progress = Math.min(1, animation.current.progress + delta * 0.7);
      const eased = 1 - Math.pow(1 - animation.current.progress, 3);

      camera.position.lerpVectors(animation.current.startPos, animation.current.endPos, eased);
      controls.target.lerpVectors(animation.current.startTarget, animation.current.endTarget, eased);
      controls.update();

      if (animation.current.progress >= 1) {
        animation.current.isAnimating = false;
      }
    } else {
      controls.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enabled={controlsEnabled}
      minDistance={6}
      maxDistance={80}
      minPolarAngle={Math.PI / 5}
      maxPolarAngle={(Math.PI * 0.95) / 2}
      onChange={onInteractionStart}
    />
  );
}

// Main scene
function Scene({
  activeTown,
  setActiveTown,
  controlsEnabled,
  onInteractionStart,
}: {
  activeTown: Town | null;
  setActiveTown: (town: Town | null) => void;
  controlsEnabled: boolean;
  onInteractionStart: () => void;
}) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayIndex = useRef(0);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      autoPlayIndex.current = (autoPlayIndex.current + 1) % towns.length;
      setActiveTown(towns[autoPlayIndex.current]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, setActiveTown]);

  return (
    <>
      {/* Enhanced lighting for dramatic map-like shadows */}
      <ambientLight intensity={0.05} />
      <directionalLight position={[12, 18, 10]} intensity={2.3} castShadow color="#fff5e6" />
      <directionalLight position={[-14, 12, -6]} intensity={0.15} color="#dfe7ff" />
      <hemisphereLight color="#fff3cc" groundColor="#050200" intensity={0.1} />

      {/* Terrain */}
      <Terrain />

      {/* State Borders */}
      <StateBorders />

      {/* Towns */}
      {towns.map((town) => (
        <TownMarker
          key={town.id}
          town={town}
          isActive={activeTown?.id === town.id}
          onClick={() => {
            setActiveTown(town);
            setIsAutoPlaying(false);
            onInteractionStart();
          }}
        />
      ))}

      {/* Camera */}
      <CameraRig activeTown={activeTown} onInteractionStart={onInteractionStart} controlsEnabled={controlsEnabled} />
    </>
  );
}

// Sidebar location list
function LocationSidebar({
  activeTown,
  onSelectTown,
}: {
  activeTown: Town | null;
  onSelectTown: (town: Town) => void;
}) {
  return (
    <div
      className="location-sidebar"
      style={{
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      <h2
        style={{
          color: '#C0C0C0',
          fontSize: '28px',
          fontWeight: 900,
          marginTop: 0,
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        Our Locations
      </h2>
      <p style={{ color: '#999', fontSize: '14px', marginBottom: '30px' }}>Click a location to fly there</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {towns.map((town) => {
          const isActive = activeTown?.id === town.id;

          return (
            <div
              key={town.id}
              onClick={() => onSelectTown(town)}
              style={{
                background: isActive ? 'rgba(192, 192, 192, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '2px solid #C0C0C0' : '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#C0C0C0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              {town.badge && (
                <div
                  style={{
                    display: 'inline-block',
                    background: '#C0C0C0',
                    color: 'black',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '9px',
                    fontWeight: 900,
                    letterSpacing: '1px',
                    marginBottom: '10px',
                  }}
                >
                  {town.badge}
                </div>
              )}

              <h3
                style={{
                  color: isActive ? '#C0C0C0' : 'white',
                  fontSize: '20px',
                  fontWeight: 900,
                  margin: '0 0 8px 0',
                }}
              >
                {town.name}
              </h3>

              {isActive && (
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <p style={{ color: '#AAA', fontSize: '13px', fontStyle: 'italic', marginBottom: '15px' }}>
                    {town.description}
                  </p>

                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        color: '#C0C0C0',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '5px',
                      }}
                    >
                      Address
                    </div>
                    <div
                      style={{ color: '#CCC', fontSize: '13px', lineHeight: '1.5' }}
                      dangerouslySetInnerHTML={{ __html: town.address }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        color: '#C0C0C0',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '5px',
                      }}
                    >
                      Phone
                    </div>
                    <a
                      href={`tel:${town.phone}`}
                      style={{
                        color: '#FFF',
                        fontSize: '14px',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      {town.phone}
                    </a>
                  </div>

                  {town.email && (
                    <div style={{ marginBottom: '12px' }}>
                      <div
                        style={{
                          color: '#C0C0C0',
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          marginBottom: '5px',
                        }}
                      >
                        Email
                      </div>
                      <a
                        href={`mailto:${town.email}`}
                        style={{
                          color: '#FFF',
                          fontSize: '13px',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {town.email}
                      </a>
                    </div>
                  )}

                  <div style={{ marginTop: '15px' }}>
                    <div
                      style={{
                        color: '#C0C0C0',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '8px',
                      }}
                    >
                      Services
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {town.services.map((service, idx) => (
                        <li
                          key={idx}
                          style={{
                            color: '#CCC',
                            fontSize: '12px',
                            marginBottom: '5px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ color: '#C0C0C0', marginRight: '8px' }}>✓</span>
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main component - FULLSCREEN
export default function SimpleTerrainMap() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTown, setActiveTown] = useState<Town | null>(null);
  const [controlsEnabled, setControlsEnabled] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1200);
  }, []);

  const handleInteractionStart = () => {
    if (!controlsEnabled) {
      setControlsEnabled(true);
    }
  };

  return (
    <>
      <style>{`
        .terrain-map-container {
          width: 100%;
          max-width: 90vw;
          height: 85vh;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          border-radius: 16px;
        }

        .location-sidebar {
          position: absolute;
          right: 0;
          top: 0;
          width: 100%;
          max-width: 400px;
          height: 100%;
          background: rgba(26, 26, 26, 0.95);
          backdrop-filter: blur(10px);
          border-left: 3px solid #C0C0C0;
          border-radius: 16px 0 0 16px;
          z-index: 10;
          overflow-y: auto;
          padding: 20px;
        }

        .terrain-canvas-wrapper {
          height: 100%;
          width: 100%;
        }

        @media (max-width: 768px) {
          .terrain-map-container {
            max-width: 100vw;
            height: auto;
            min-height: auto;
            display: flex;
            flex-direction: column;
            border-radius: 0;
          }

          .location-sidebar {
            position: relative;
            right: auto;
            top: auto;
            max-width: 100%;
            height: auto;
            border-left: none;
            border-top: 3px solid #C0C0C0;
            border-radius: 0;
            order: 2;
            margin-top: 0;
          }

          .terrain-canvas-wrapper {
            order: 1;
            height: 350px;
            min-height: 350px;
          }

          .terrain-canvas-wrapper canvas {
            border-radius: 0 !important;
          }
        }
      `}</style>
      <div className="terrain-map-container">
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              color: '#C0C0C0',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🗺️</div>
              <div>Loading 3D Terrain...</div>
            </div>
          </div>
        )}

        <div className="terrain-canvas-wrapper">
          <Canvas
            camera={{ position: [-3.6, 4, 5.1], fov: 45 }}
            shadows
            style={{
              background: 'linear-gradient(to bottom, #0a0a0a 0%, #1a1a1a 100%)',
              borderRadius: '16px',
              cursor: controlsEnabled ? 'grab' : 'pointer',
              width: '100%',
              height: '100%',
            }}
            onClick={handleInteractionStart}
          >
            <Scene
              activeTown={activeTown}
              setActiveTown={setActiveTown}
              controlsEnabled={controlsEnabled}
              onInteractionStart={handleInteractionStart}
            />
          </Canvas>
        </div>

        {/* Sidebar */}
        <LocationSidebar
          activeTown={activeTown}
          onSelectTown={(town) => {
            setActiveTown(town);
            handleInteractionStart();
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '14px 24px',
            borderRadius: '12px',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
            border: '2px solid #C0C0C0',
            pointerEvents: 'none',
          }}
        >
          Click markers to fly to locations
        </div>
      </div>
    </>
  );
}
