import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(__dirname, "header-mobile-sheet.html");
const outDir = path.resolve(
  __dirname,
  "../../../reviews/assets/PR789-pd-ui-framework",
);

const surfaces = ["marketing", "app"];
const widths = [390, 360, 320];
const locales = ["vi", "en"];
const menus = ["closed", "open"];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

for (const surface of surfaces) {
  const prefix = surface === "marketing" ? "mkt" : "app";
  for (const width of widths) {
    for (const locale of locales) {
      for (const menu of menus) {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`file://${html}`, { waitUntil: "networkidle" });
        await page.click(`[data-surface="${surface}"]`);
        await page.click(`[data-width="${width}"]`);
        await page.click(`[data-locale="${locale}"]`);
        await page.click(`[data-menu="${menu}"]`);
        await page.waitForTimeout(300);
        const file = `${prefix}-${width}-${locale}-${menu}.png`;
        if (menu === "open") {
          // Sheet is position:fixed to the window, outside #device-frame —
          // shrink the window to the device width so the panel renders as on a phone.
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(outDir, file) });
        } else {
          const frame = page.locator("#device-frame");
          await frame.screenshot({ path: path.join(outDir, file) });
        }
        console.log("wrote", file);
      }
    }
  }
}

await browser.close();
