import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(__dirname, "index.html");
const outDir = path.resolve(
  __dirname,
  "../../../reviews/assets/ui-uplift-marketing",
);

const shots = [
  { device: "desktop", locale: "vi", file: "marketing-desktop-1280-vi.png" },
  { device: "mobile", locale: "vi", file: "marketing-mobile-390-vi.png" },
  { device: "desktop", locale: "en", file: "marketing-desktop-1280-en.png" },
  { device: "mobile", locale: "en", file: "marketing-mobile-390-en.png" },
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();

for (const shot of shots) {
  const width = shot.device === "desktop" ? 1280 : 390;
  const height = shot.device === "desktop" ? 900 : 844;
  await page.setViewportSize({ width, height: shot.device === "desktop" ? 1100 : 900 });
  await page.goto(`file://${html}`, { waitUntil: "networkidle" });
  await page.click(`#btn-${shot.device}`);
  if (shot.locale === "en") {
    await page.click("#locale-en");
  } else {
    await page.click("#locale-vi");
  }
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const site = document.querySelector(".browser .site");
    if (site) {
      site.style.height = "auto";
      site.style.overflow = "visible";
      site.style.maxHeight = "none";
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(outDir, shot.file),
    fullPage: true,
  });
  console.log("wrote", shot.file);
}

await browser.close();
