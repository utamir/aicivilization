// ─────────────────────────────────────────────────────────────────────────────
// LABELS — settlement names anchored in the world, with the people who live
// there. Sizes follow population; the biggest city of a civilization is bold.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CITIES, civMainCity } from './layout';
import { heightAt } from './terrain';
import { useUI } from '../state/store';
import type { WorldVisual } from './cityVisuals';

function CityLabel({ id, visualRef }: { id: string; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const city = CITIES.find((c) => c.id === id)!;
  const el = useRef<HTMLDivElement>(null);
  const main = civMainCity(city.civId).id === city.id;
  useFrame(() => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    if (!el.current || !vis) return;
    const pop = vis.population;
    const sub = el.current.querySelector('.lbl-sub') as HTMLElement | null;
    if (sub) sub.textContent = `${pop >= 1 ? pop.toFixed(1) : (pop * 1000).toFixed(0)}${pop >= 1 ? 'M' : 'k'} · ${vis.derelict > 0.18 ? 'emptying' : vis.crowding > 0.15 ? 'crowded' : vis.nightDim > 0.4 ? 'blackouts' : city.kind}`;
    el.current.style.opacity = useUI.getState().hudVisible ? '1' : '0';
    el.current.classList.toggle('lbl-selected', useUI.getState().selectedCiv === city.civId);
  });
  return (
    <Html position={[city.x, heightAt(city.x, city.z) + 3.5 + (main ? 2 : 0), city.z]} center distanceFactor={140} zIndexRange={[2, 1]} occlude style={{ pointerEvents: 'none' }}>
      <div ref={el} className={`city-label civ-${city.civId} ${main ? 'lbl-main' : ''}`}>
        <div className="lbl-name">{city.name}</div>
        <div className="lbl-sub">{city.kind}</div>
      </div>
    </Html>
  );
}

export function Labels({ visualRef }: { visualRef: React.MutableRefObject<WorldVisual | null> }) {
  return <>{CITIES.map((c) => <CityLabel key={c.id} id={c.id} visualRef={visualRef} />)}</>;
}
