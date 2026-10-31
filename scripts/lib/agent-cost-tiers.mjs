/** Provider-neutral tiers; routes are ordered by dispatch preference (Claude before Codex). */
export const COST_TIER_ROUTES = {
  cheap: [{ agent: "cursor", models: ["composer-2.5", "grok-4.7-low", "gemini-3.7-flash-low"], effort: null }],
  standard: [{ agent: "codex", models: ["gpt-6.1-terra"], effort: "low", quotaLimitIds: ["codex"] }, { agent: "cursor", models: ["composer-2.5", "grok-4.7-low", "gemini-3.7-flash-low"], effort: null }],
  focused: [
    { agent: "claude", models: ["claude-sonnet-5"], effort: "low" },
    { agent: "codex", models: ["gpt-6-sol", "gpt-6.1-sol", "gpt-6.1-terra"], effort: "low", quotaLimitIds: ["codex"] },
  ],
  advanced: [
    { agent: "claude", models: ["claude-sonnet-5"], effort: "medium" },
    { agent: "codex", models: ["gpt-6-sol", "gpt-6.1-terra"], effort: "medium", quotaLimitIds: ["codex"] },
  ],
  high: [
    { agent: "claude", models: ["claude-sonnet-5"], effort: "high" },
    { agent: "codex", models: ["gpt-6-sol", "gpt-6.1-terra"], effort: "high", quotaLimitIds: ["codex"] },
  ],
};

export const COST_TIERS = Object.keys(COST_TIER_ROUTES);

// Read historical evidence without allowing legacy names for new launches.
export const LEGACY_COST_TIERS = { "codex-low": "focused", "codex-medium": "advanced", heavy: "standard" };

export function routingError({ costTier, agent, model, effort }) {
  if (!Object.hasOwn(COST_TIER_ROUTES, costTier)) {
    return `Thiếu hoặc sai --cost-tier; chọn ${COST_TIERS.join("|")}.`;
  }
  const routes = COST_TIER_ROUTES[costTier];
  if (!routes.some((route) => agent === route.agent && route.models.includes(model) && (effort ?? null) === route.effort)) {
    const allowed = routes.map((route) => `agent=${route.agent}, model=${route.models.join("|")}, ` +
      (route.effort ? `effort=${route.effort}` : "không truyền --effort")).join(" hoặc ");
    return `Tier ${costTier} cần mapping đã đăng ký: ${allowed}.`;
  }
  return null;
}
