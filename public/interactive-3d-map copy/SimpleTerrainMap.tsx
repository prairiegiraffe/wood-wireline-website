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
    id: 'williston',
    name: 'Williston, ND',
    badge: null,
    x: -5.8,
    z: -7.3,
    address: 'Contact us for details',
    phone: '307-682-8688',
    email: null,
    services: ['Full functional mud lab', 'Particle size analysis', 'Drilling fluid supplies'],
    description: 'Supporting operations in the Bakken formation',
  },
  {
    id: 'gillette',
    name: 'Gillette, WY',
    badge: 'HEADQUARTERS',
    x: -7.6,
    z: -2.9,
    address: '103 E. Lincoln St.<br/>Gillette, WY 82716',
    phone: '307-682-8688',
    email: null,
    services: ['Full mud engineering', '24/7 delivery', 'Mud lab', 'Technical support'],
    description: 'Our headquarters in the heart of the Powder River Basin',
  },
  {
    id: 'cheyenne',
    name: 'Cheyenne, WY',
    badge: null,
    x: -6.9,
    z: 0.5,
    address: 'Contact us for details',
    phone: '307-682-8688',
    email: null,
    services: ['Drilling fluid supplies', 'Delivery services', 'Technical support'],
    description: 'Serving the southern Wyoming energy corridor',
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
          <lineBasicMaterial color="#FF6600" linewidth={1} opacity={0.4} transparent />
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
          color="#FF6600"
          emissive="#FF6600"
          emissiveIntensity={isActive ? 2.5 : 1.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Light */}
      <pointLight color="#FF6600" intensity={isActive ? 6 : 3} distance={12} />

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
            border: '2px solid #FF6600',
            boxShadow: '0 4px 20px rgba(255, 102, 0, 0.5)',
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
          color: '#FF6600',
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
                background: isActive ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '2px solid #FF6600' : '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#FF6600';
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
                    background: '#FF6600',
                    color: 'white',
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
                  color: isActive ? '#FF6600' : 'white',
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
                        color: '#FF6600',
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
                        color: '#FF6600',
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
                          color: '#FF6600',
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
                        color: '#FF6600',
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
                          <span style={{ color: '#FF6600', marginRight: '8px' }}>✓</span>
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
          border-left: 3px solid #FF6600;
          border-radius: 16px 0 0 16px;
          z-index: 10;
          overflow-y: auto;
          padding: 20px;
        }

        @media (max-width: 768px) {
          .terrain-map-container {
            max-width: 100vw;
            height: auto;
            min-height: 100vh;
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
            border-top: 3px solid #FF6600;
            border-radius: 0;
            order: 2;
          }

          .terrain-canvas-wrapper {
            order: 1;
            height: 60vh;
            min-height: 400px;
          }

          .terrain-canvas-wrapper canvas {
            border-radius: 16px 16px 0 0 !important;
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
              color: '#FF6600',
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

        <div className="terrain-canvas-wrapper" style={{ height: '100%' }}>
          <Canvas
            camera={{ position: [-3.6, 4, 5.1], fov: 45 }}
            shadows
            style={{
              background: 'linear-gradient(to bottom, #1A2A3A 0%, #2A3A4A 100%)',
              borderRadius: '16px',
              cursor: controlsEnabled ? 'grab' : 'pointer',
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
            border: '2px solid #FF6600',
            pointerEvents: 'none',
          }}
        >
          Click markers to fly to locations
        </div>
      </div>
    </>
  );
}
