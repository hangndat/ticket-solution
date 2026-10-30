import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { useState, useSyncExternalStore } from 'react';
import { PLATE_WINDOWS, type JourneyPlateId } from './assets';
import { Plate } from './plate';
import { doorInset, smoothProgress, T } from './timeline';

/**
 * 2.5D scene: AI photographic plates in one shared 3:2 cover box (so overlays
 * pinned in image % stay aligned), plus CSS light/haze/bokeh depth layers.
 * Only transform / opacity animate. Everything here is decorative.
 */

/** Gate geometry in plate % (gateway-closed / gateway-open share the frame). */
const GATE = { door: '50% 52%', pillarL: 33.5, pillarR: 66.5, top: 17, bottom: 56 } as const;

const PORTRAIT = '(orientation: portrait)';
function subscribePortrait(cb: () => void) {
  const mq = window.matchMedia(PORTRAIT);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
/** Portrait crops the 3:2 plate hard, so the camera push is gentler there. */
function usePortrait(): boolean {
  return useSyncExternalStore(subscribePortrait, () => window.matchMedia(PORTRAIT).matches, () => false);
}

/** Mount a plate shortly before it is needed, then keep it (deferred loading). */
function useMounted(p: MotionValue<number>, id: JourneyPlateId): boolean {
  const [start] = PLATE_WINDOWS[id];
  const ahead = start - 0.12;
  const [on, setOn] = useState(() => p.get() >= ahead);
  useMotionValueEvent(p, 'change', (v) => {
    if (!on && v >= ahead) setOn(true);
  });
  return on;
}

function TicketNight({ p }: { p: MotionValue<number> }) {
  const scale = useTransform(p, [0, T.arrival[0], 0.24], [1, 1.12, 1.2]);
  const opacity = useTransform(p, [0, 0.15, 0.23], [1, 1, 0]);
  return <Plate id="ticket-night" priority style={{ scale, opacity }} />;
}

function Gateway({ p }: { p: MotionValue<number> }) {
  const mounted = useMounted(p, 'gateway-closed');
  const portrait = usePortrait();
  const scale = useTransform(
    p,
    [0.15, T.arrival[1], T.gateNear[1], T.pushThrough[0], T.pushThrough[1]],
    portrait ? [1, 1.06, 1.12, 1.14, 2.6] : [1, 1.38, 1.62, 1.66, 3.4],
    { ease: smoothProgress },
  );
  const opacity = useTransform(p, [0.14, 0.22, T.pushThrough[0] + 0.02, T.pushThrough[1]], [0, 1, 1, 0]);
  // Plates match outside the doorway, so a centre-out wipe reads as the doors parting.
  const openClip = useTransform(p, doorInset);
  const clipPath = useTransform(openClip, (x) => `inset(0% ${x}% 0% ${x}%)`);
  const okGlow = useTransform(p, [T.verified - 0.005, T.verified + 0.01, T.doorsOpen[1]], [0, 1, 0.7]);
  const burst = useTransform(p, [T.doorsOpen[0], T.doorsOpen[1] - 0.02, T.pushThrough[1]], [0, 1, 0.4]);
  const scanGlow = useTransform(p, [T.scan[0] - 0.02, T.scan[0], T.verified, T.verified + 0.01], [0, 1, 1, 0]);
  if (!mounted) return null;
  return (
    <motion.div className="absolute inset-0" style={{ scale, opacity, transformOrigin: GATE.door }}>
      <Plate id="gateway-closed" />
      <Plate id="gateway-open" style={{ clipPath }} />
      {/* scan: cyan wash on the pillars while the QR is read */}
      <motion.div className="absolute inset-0 mix-blend-screen" style={{ opacity: scanGlow }}>
        {[GATE.pillarL, GATE.pillarR].map((x) => (
          <div
            key={x}
            className="absolute w-[8%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(60,225,255,0.95),rgba(40,212,239,0.35)_45%,transparent)] blur-md"
            style={{ left: `${x}%`, top: `${GATE.top}%`, height: `${GATE.bottom - GATE.top}%` }}
          />
        ))}
      </motion.div>
      {/* verified: pillars warm to amber */}
      <motion.div className="absolute inset-0 mix-blend-screen" style={{ opacity: okGlow }}>
        {[GATE.pillarL, GATE.pillarR].map((x) => (
          <div
            key={x}
            className="absolute w-[9%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,190,90,1),rgba(255,181,71,0.45)_45%,transparent)] blur-md"
            style={{ left: `${x}%`, top: `${GATE.top}%`, height: `${GATE.bottom - GATE.top}%` }}
          />
        ))}
        <div className="absolute left-1/2 top-[13%] h-[9%] w-[40%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,190,90,0.8),transparent)] blur-lg" />
      </motion.div>
      {/* doors open: light spills through the gate */}
      <motion.div
        className="absolute left-1/2 top-[52%] h-[60%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,0.55),rgba(155,77,255,0.25)_55%,transparent)] mix-blend-screen blur-xl"
        style={{ opacity: burst }}
      />
    </motion.div>
  );
}

function Stage({ p }: { p: MotionValue<number> }) {
  const mounted = useMounted(p, 'stage-main');
  const scale = useTransform(p, [T.stageIn[0], T.stageIn[1], 1], [1.16, 1.03, 1]);
  const y = useTransform(p, [T.stageIn[0], 1], ['3%', '0%']);
  const opacity = useTransform(p, [T.pushThrough[0], T.pushThrough[1]], [0, 1], { ease: smoothProgress });
  const alive = useTransform(p, [0.7, 0.82], [0, 1]);
  if (!mounted) return null;
  return (
    <motion.div className="absolute inset-0" style={{ scale, y, opacity, transformOrigin: '50% 45%' }}>
      <Plate id="stage-main" />
      {/* stage "comes alive": slow light sweep + pulse over the photo */}
      <motion.div className="absolute inset-0 mix-blend-screen" style={{ opacity: alive }}>
        <div className="jr-anim jr-sweep absolute -top-[10%] left-[30%] h-[80%] w-[14%] origin-bottom bg-[linear-gradient(to_top,rgba(40,212,239,0.35),transparent)] blur-lg" />
        <div className="jr-anim jr-sweep jr-sweep-r absolute -top-[10%] left-[56%] h-[80%] w-[14%] origin-bottom bg-[linear-gradient(to_top,rgba(155,77,255,0.4),transparent)] blur-lg" />
        <div className="jr-anim jr-pulse absolute left-1/2 top-[48%] h-[40%] w-[50%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,0.3),transparent)] blur-2xl" />
      </motion.div>
    </motion.div>
  );
}

/** Foreground lantern bokeh — the nearest depth plane, so it moves fastest. */
const BOKEH = [
  { x: 6, y: 78, s: 9, d: 1.2 },
  { x: 16, y: 92, s: 13, d: 1.6 },
  { x: 86, y: 80, s: 10, d: 1.3 },
  { x: 95, y: 94, s: 14, d: 1.7 },
  { x: 24, y: 70, s: 6, d: 0.9 },
  { x: 75, y: 71, s: 6, d: 0.9 },
];
function Bokeh({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, [0.16, 0.24, T.gateNear[1], T.pushThrough[0]], [0, 0.85, 0.85, 0]);
  const spread = useTransform(p, [0.16, T.pushThrough[0]], [1, 1.7]);
  return (
    <motion.div className="absolute inset-0" style={{ opacity, scale: spread, transformOrigin: GATE.door }}>
      {BOKEH.map((b, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,200,120,0.7),rgba(255,181,71,0.15)_60%,transparent)] blur-[6px]"
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.s}vmin`, height: `${b.s}vmin` }}
        />
      ))}
    </motion.div>
  );
}

/** Drifting haze bands at two depths for atmospheric parallax. */
function Haze({ p }: { p: MotionValue<number> }) {
  const nearX = useTransform(p, [0, 1], ['-6%', '6%']);
  const farX = useTransform(p, [0, 1], ['4%', '-3%']);
  const opacity = useTransform(p, [0, 0.4, 0.62, 0.8, 1], [0.35, 0.55, 0.7, 0.45, 0.3]);
  return (
    <motion.div className="pointer-events-none absolute inset-0" style={{ opacity }}>
      <motion.div
        className="absolute inset-x-[-20%] bottom-[8%] h-[30%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(170,160,255,0.22),transparent)] blur-2xl"
        style={{ x: farX }}
      />
      <motion.div
        className="absolute inset-x-[-20%] bottom-[-6%] h-[26%] bg-[radial-gradient(50%_50%_at_40%_60%,rgba(200,210,255,0.18),transparent)] blur-xl"
        style={{ x: nearX }}
      />
    </motion.div>
  );
}

/**
 * Still frames (no-JS / reduced motion) render only the plates visible at their
 * fixed progress; the scroll journey mounts plates just ahead of need.
 */
export function SceneLayers({ p, still = false }: { p: MotionValue<number>; still?: boolean }) {
  const v = p.get();
  const show = (id: JourneyPlateId) => {
    if (!still) return true;
    const [a, b] = PLATE_WINDOWS[id];
    return v >= a && v <= b;
  };
  return (
    <>
      {/* 3:2 cover box (matches every plate) */}
      <div className="absolute left-1/2 top-1/2 aspect-[3/2] w-[max(100%,150dvh)] -translate-x-1/2 -translate-y-1/2">
        {show('ticket-night') ? <TicketNight p={p} /> : null}
        {show('gateway-closed') ? <Gateway p={p} /> : null}
        {show('stage-main') ? <Stage p={p} /> : null}
      </div>
      <Haze p={p} />
      <Bokeh p={p} />
    </>
  );
}
