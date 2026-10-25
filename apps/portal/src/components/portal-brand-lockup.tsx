const V_MARK_WIDTH = 32;
const V_MARK_HEIGHT = 28;

export function PortalBrandMark() {
  return (
    <img
      src="/brand/vemoki-v-mark.webp"
      alt=""
      width={V_MARK_WIDTH}
      height={V_MARK_HEIGHT}
      className="portal-brand-mark"
    />
  );
}

export function PortalBrandLockup() {
  return (
    <span className="portal-brand-lockup">
      <PortalBrandMark />
      <span className="portal-brand-text">Vemoki Portal</span>
    </span>
  );
}
