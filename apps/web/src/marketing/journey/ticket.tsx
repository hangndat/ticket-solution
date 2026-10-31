import { motion, useTransform, type MotionValue } from 'motion/react';
import { PALETTE as C, qrMatrix, qrPath } from './art';
import type { JourneyCopy } from './copy';
import { T } from './timeline';

const QR = qrMatrix();
const QR_D = qrPath(QR);
const QR_N = QR.length;

/** The hero object: a digital ticket that emerges, travels, is scanned and handed off. */
export function JourneyTicket({ p, copy }: { p: MotionValue<number>; copy: JourneyCopy }) {
  // Visible on first paint (no scroll needed); scrolling settles it into place.
  const opacity = useTransform(p, [T.ticketOut[0], T.ticketOut[1]], [1, 0]);
  const scale = useTransform(
    p,
    [0, T.ticketIn[1], T.arrival[0], T.arrival[1], T.scan[0], T.ticketOut[1]],
    [0.94, 1, 1, 0.66, 0.74, 0.52],
  );
  const rotateX = useTransform(p, [0, T.ticketIn[1], T.arrival[1], T.scan[0]], [14, 0, 14, 0]);
  const rotateY = useTransform(p, [T.ticketIn[1], T.arrival[0] + 0.06, T.arrival[1], T.scan[0]], [0, -10, 6, 0]);
  const y = useTransform(
    p,
    [0, T.ticketIn[1], T.arrival[1], T.scan[0], T.ticketOut[1]],
    ['4%', '0%', '26%', '10%', '-20%'],
  );
  const glow = useTransform(p, [0, T.ticketIn[1], T.arrival[0]], [0.8, 1, 0.6]);
  const sheen = useTransform(p, [0.01, T.ticketIn[1] + 0.03], ['-120%', '260%']);
  const scanTop = useTransform(p, [T.scan[0], T.verified], ['0%', '100%']);
  const scanO = useTransform(p, [T.scan[0] - 0.01, T.scan[0], T.verified - 0.004, T.verified], [0, 1, 1, 0]);
  const ok = useTransform(p, [T.verified - 0.004, T.verified + 0.008], [0, 1]);
  const okScale = useTransform(p, [T.verified - 0.004, T.verified + 0.012], [0.6, 1]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center [perspective:1200px] max-md:items-start max-md:pt-[22dvh] [@media(max-height:560px)_and_(orientation:landscape)]:items-center [@media(max-height:560px)_and_(orientation:landscape)]:justify-end [@media(max-height:560px)_and_(orientation:landscape)]:pt-[72px] [@media(max-height:560px)_and_(orientation:landscape)]:pr-[9vw]">
      <motion.div
        className="relative w-[clamp(220px,23vw,320px)] max-md:w-[min(62vw,280px)] [@media(max-height:560px)_and_(orientation:landscape)]:w-[min(30dvh,150px)]"
        style={{ opacity, scale, rotateX, rotateY, y }}
      >
        <motion.div
          className="absolute -inset-[18%] rounded-[40%] bg-[radial-gradient(closest-side,rgba(155,77,255,0.55),rgba(40,212,239,0.18)_60%,transparent)] blur-2xl"
          style={{ opacity: glow }}
        />
        <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(160deg,#1a1450_0%,#0c0f2e_45%,#081a2c_100%)] p-[1px] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-0 rounded-[22px] bg-[linear-gradient(140deg,rgba(155,77,255,0.9),rgba(40,212,239,0.6)_50%,rgba(255,181,71,0.7))] opacity-70" />
          <div className="relative rounded-[21px] bg-[linear-gradient(170deg,#141238_0%,#090b22_60%,#07101f_100%)] px-[9%] pb-[8%] pt-[9%] text-[#f4f1ff]">
            <div className="flex items-center justify-between gap-2 whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[#c2c6de] [@media(max-height:560px)_and_(orientation:landscape)]:text-[0.45rem] [@media(max-height:560px)_and_(orientation:landscape)]:tracking-[0.16em]">
              <span>Vemoki ↗</span>
              <span>{copy.ticket.admit}</span>
            </div>
            <p className="mt-[14%] font-display text-[clamp(1.5rem,2.6vw,2.15rem)] [@media(max-height:560px)_and_(orientation:landscape)]:text-[1.05rem] font-bold leading-[0.95] tracking-tight">
              {copy.ticket.event}
            </p>
            <div className="mt-3 flex gap-4 text-[0.7rem] text-[#c2c6de] [@media(max-height:560px)_and_(orientation:landscape)]:mt-1 [@media(max-height:560px)_and_(orientation:landscape)]:gap-2 [@media(max-height:560px)_and_(orientation:landscape)]:text-[0.5rem]">
              <span>{copy.ticket.date}</span>
              <span className="text-[color:var(--jr-amber)]">{copy.ticket.gate}</span>
            </div>

            <div className="relative -mx-[11%] my-[9%] border-t border-dashed border-white/20">
              <span className="absolute -left-2 -top-2 size-4 rounded-full bg-[#03040c]" />
              <span className="absolute -right-2 -top-2 size-4 rounded-full bg-[#03040c]" />
            </div>

            <div className="relative mx-auto aspect-square w-[78%] rounded-xl bg-[#f4f1ff] p-[7%]">
              <svg viewBox={`0 0 ${QR_N} ${QR_N}`} className="block h-full w-full" shapeRendering="crispEdges" aria-hidden="true">
                <path d={QR_D} fill={C.navy} />
              </svg>
              <motion.div className="absolute inset-x-[4%] h-[3px] -translate-y-1/2 rounded-full bg-[var(--jr-cyan)] shadow-[0_0_18px_4px_rgba(40,212,239,0.75)]" style={{ top: scanTop, opacity: scanO }} />
              <motion.div
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-[rgba(6,8,23,0.78)]"
                style={{ opacity: ok }}
              >
                <motion.span
                  className="flex flex-col items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--jr-amber)]"
                  style={{ scale: okScale }}
                >
                  <svg viewBox="0 0 48 48" className="size-14" aria-hidden="true">
                    <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M14 25l7 7 13-15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {copy.scanOk}
                </motion.span>
              </motion.div>
            </div>
            <p className="mt-[8%] text-center text-[0.62rem] uppercase tracking-[0.3em] text-[#989dbd] [@media(max-height:560px)_and_(orientation:landscape)]:text-[0.45rem] [@media(max-height:560px)_and_(orientation:landscape)]:tracking-[0.18em]">
              {copy.ticket.holder}
            </p>
          </div>
          <motion.div
            className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
            style={{ x: sheen }}
          />
        </div>
      </motion.div>
    </div>
  );
}
