#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "../../../reviews/assets/ui-uplift-app");
const fileUrl = `file://${join(root, "index.html")}`;

const shots = [
  { name: "catalog-guest", click: "Guest · Catalog" },
  { name: "catalog-user", click: "User · Catalog" },
  { name: "event-detail", click: "Event detail" },
  { name: "redeem-guest", click: "Redeem · gate" },
  { name: "redeem-error", click: "Redeem · error" },
  { name: "redeem-success", click: "Redeem · success" },
  { name: "wallet", click: "Wallet" },
  { name: "ticket-qr", click: "Ticket · QR" },
  { name: "account", click: "Account" },
  { name: "wallet-empty", click: "Wallet empty" },
  { name: "loading", click: "Loading" },
  { name: "claim-invite", click: "Claim invite" },
];

async function capture(viewport, suffix, mobileFrame) {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport });
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  if (mobileFrame) {
    await page.locator("#btnMobile").click();
    await page.waitForTimeout(200);
  }

  for (const { name, click } of shots) {
    await page.getByRole("button", { name: click, exact: true }).click();
    await page.waitForTimeout(350);
    const path = join(outDir, `${name}-${suffix}.png`);
    await page.locator("#browser").screenshot({ path });
    console.log("wrote", path);
  }

  await browser.close();
}

await mkdir(outDir, { recursive: true });
await capture({ width: 1280, height: 900 }, "1280", false);
await capture({ width: 1280, height: 900 }, "390", true);
