// ─────────────────────────────────────────────────────────────────────────────
// WORLD LAYOUT — fixed geography of the fictional region (220×220 units).
// Three polities, six cities, roads, infra anchor zones.
// ─────────────────────────────────────────────────────────────────────────────
import type { CivId } from '../sim';

export const WORLD_SIZE = 220;

export interface CityLayout {
  id: string;
  name: string;
  civId: CivId;
  x: number; z: number;
  kind: 'capital' | 'industrial' | 'campus' | 'port' | 'energy' | 'frontier';
  basePop: number; // millions share
  districtRadius: number;
}

export const CITIES: CityLayout[] = [
  { id: 'meridian', name: 'Meridian', civId: 'veloria', x: -46, z: -10, kind: 'capital', basePop: 18, districtRadius: 15 },
  { id: 'serein', name: 'Port Serein', civId: 'veloria', x: -68, z: -34, kind: 'port', basePop: 11, districtRadius: 11 },
  { id: 'ferrum', name: 'Ferrum', civId: 'ardan', x: 56, z: 16, kind: 'industrial', basePop: 52, districtRadius: 19 },
  { id: 'cascade', name: 'Cascade', civId: 'ardan', x: 34, z: -26, kind: 'campus', basePop: 30, districtRadius: 14 },
  { id: 'solace', name: 'Solace', civId: 'nemea', x: -8, z: 56, kind: 'capital', basePop: 40, districtRadius: 15 },
  { id: 'ember', name: 'Ember Fields', civId: 'nemea', x: 30, z: 68, kind: 'energy', basePop: 20, districtRadius: 11 },
];

export interface InfraZone {
  id: string;
  civId: CivId;
  type: 'solar' | 'wind' | 'nuclear' | 'datacenter' | 'port' | 'farm' | 'spaceport';
  x: number; z: number;
  size: number;
}

export const INFRA_ZONES: InfraZone[] = [
  { id: 'vel-solar', civId: 'veloria', type: 'solar', x: -20, z: -44, size: 12 },
  { id: 'vel-wind', civId: 'veloria', type: 'wind', x: -78, z: 8, size: 12 },
  { id: 'vel-nuclear', civId: 'veloria', type: 'nuclear', x: -84, z: -12, size: 8 },
  { id: 'vel-dc', civId: 'veloria', type: 'datacenter', x: -28, z: 8, size: 10 },
  { id: 'vel-port', civId: 'veloria', type: 'port', x: -74, z: -42, size: 9 },
  { id: 'vel-farm', civId: 'veloria', type: 'farm', x: -24, z: 22, size: 12 },
  { id: 'ard-solar', civId: 'ardan', type: 'solar', x: 82, z: -8, size: 14 },
  { id: 'ard-wind', civId: 'ardan', type: 'wind', x: 86, z: 34, size: 12 },
  { id: 'ard-nuclear', civId: 'ardan', type: 'nuclear', x: 70, z: -34, size: 8 },
  { id: 'ard-dc', civId: 'ardan', type: 'datacenter', x: 48, z: -38, size: 12 },
  { id: 'ard-farm', civId: 'ardan', type: 'farm', x: 74, z: 52, size: 18 },
  { id: 'nem-solar', civId: 'nemea', type: 'solar', x: 14, z: 84, size: 16 },
  { id: 'nem-wind', civId: 'nemea', type: 'wind', x: -34, z: 78, size: 12 },
  { id: 'nem-dc', civId: 'nemea', type: 'datacenter', x: 6, z: 38, size: 9 },
  { id: 'nem-farm', civId: 'nemea', type: 'farm', x: -38, z: 52, size: 20 },
  { id: 'nem-port', civId: 'nemea', type: 'port', x: -2, z: 92, size: 8 },
  // Spaceports sit on open ground away from the capitals; they appear only
  // once a civilization has built launch capacity.
  { id: 'vel-space', civId: 'veloria', type: 'spaceport', x: -6, z: -36, size: 10 },
  { id: 'ard-space', civId: 'ardan', type: 'spaceport', x: 92, z: 14, size: 10 },
  { id: 'nem-space', civId: 'nemea', type: 'spaceport', x: -22, z: 92, size: 10 },
];

// road polylines [x,z] waypoints
export const ROADS: Array<{ a: string; b: string; pts: [number, number][] }> = [
  { a: 'meridian', b: 'serein', pts: [[-46, -10], [-56, -20], [-68, -34]] },
  { a: 'meridian', b: 'cascade', pts: [[-46, -10], [-10, -16], [10, -22], [34, -26]] },
  { a: 'cascade', b: 'ferrum', pts: [[34, -26], [46, -6], [56, 16]] },
  { a: 'meridian', b: 'solace', pts: [[-46, -10], [-34, 22], [-20, 40], [-8, 56]] },
  { a: 'solace', b: 'ember', pts: [[-8, 56], [10, 62], [30, 68]] },
  { a: 'ferrum', b: 'ember', pts: [[56, 16], [52, 42], [30, 68]] },
  { a: 'serein', b: 'solace', pts: [[-68, -34], [-58, 6], [-40, 36], [-8, 56]] },
];

export const CIV_REGION_COLORS: Record<CivId, string> = {
  veloria: '#5B8CFF',
  ardan: '#FFB454',
  nemea: '#4FD1A5',
};

export function cityById(id: string): CityLayout {
  return CITIES.find((c) => c.id === id)!;
}

export function civMainCity(civId: CivId): CityLayout {
  return CITIES.find((c) => c.civId === civId && c.kind === 'capital')
    ?? CITIES.filter((c) => c.civId === civId).sort((a, b) => b.basePop - a.basePop)[0];
}
