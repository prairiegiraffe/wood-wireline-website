# Interactive 3D Terrain Map Component

This directory contains the archived 3D terrain map component that was originally created for the MTN Mud website locations page. It was moved here for future use with another client.

## What's Included

- `SimpleTerrainMap.tsx` - The main React component built with React Three Fiber
- `heightmap-north-america-cropped.png` - Heightmap texture for terrain elevation
- `us-states.geojson` - GeoJSON data for US state borders

## Features

- **3D Terrain Visualization**: Interactive 3D map using heightmap data
- **Animated Location Markers**: Glowing, pulsing markers for business locations
- **Fly-to Animation**: Smooth camera transitions when clicking locations
- **Location Sidebar**: Interactive panel showing location details
- **Mobile Responsive**: Adapts layout for mobile devices
- **State Borders**: Rendered from GeoJSON data

## Tech Stack

- React
- Three.js
- @react-three/fiber
- @react-three/drei
- TypeScript

## How to Use in Another Project

1. Copy this entire directory to your new project
2. Install dependencies:
   ```bash
   npm install three @react-three/fiber @react-three/drei
   ```
3. Copy the heightmap and GeoJSON files to your `public` directory
4. Import and use the component:
   ```tsx
   import SimpleTerrainMap from './path/to/SimpleTerrainMap';

   <SimpleTerrainMap client:load />
   ```
5. Update the `towns` array in the component with your new location data
6. Adjust colors and styling to match your client's brand

## Location Data Structure

The component expects location data in this format:

```typescript
{
  id: string;
  name: string;
  badge: string | null;
  x: number;        // 3D coordinate
  z: number;        // 3D coordinate
  address: string;
  phone: string;
  email: string | null;
  services: string[];
  description: string;
}
```

## Customization Notes

- Colors: Search for `#FF6600` (Safety Orange) to update brand colors
- Camera position: Adjust `DEFAULT_CAMERA_POSITION` and `DEFAULT_CAMERA_TARGET`
- Terrain scale: Modify `TERRAIN_WIDTH`, `TERRAIN_HEIGHT`, and `HEIGHT_SCALE`
- Animation speed: Change animation parameters in the `CameraRig` component

## Performance Considerations

- The heightmap is loaded and processed on the client side
- State borders are drawn as line geometries
- Uses WebGL for 3D rendering
- Mobile devices may experience reduced performance with complex scenes

## Original Use Case

Created for MTN Mud Service & Supply to showcase their three locations:
- Gillette, WY (Headquarters)
- Cheyenne, WY
- Williston, ND

The component was part of a locations page showing their strategic positioning across Wyoming and North Dakota for serving the oil and gas drilling industry.

---

**Date Archived**: 2025-11-06
**Original Project**: MTN Mud Website
