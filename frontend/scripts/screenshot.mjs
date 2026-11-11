#!/usr/bin/env node
// Minimal browser-automation helper for the UX Validator role
// (_docs/team/ux-validator.md) and anyone else who needs to actually look
// at a rendered page instead of reasoning from code alone.
//
// Usage:
//   node scripts/screenshot.mjs <url> <output.png> [--viewport=390x844] [--wait=<css selector>]
//
// Examples:
//   node scripts/screenshot.mjs http://localhost:5173/ /tmp/landing.png
//   node scripts/screenshot.mjs http://localhost:5173/dashboard /tmp/dash.png --wait=".card-grid"
//   node scripts/screenshot.mjs http://localhost:5173/settings /tmp/settings-phone.png --viewport=390x844
//
// Prints any browser console errors/page errors it observes, and the final
// page title, so a caller can tell a blank/broken render from a real one
// without needing to view the image.

import { chromium } from 'playwright'

const [, , url, outPath, ...flags] = process.argv

if (!url || !outPath) {
  console.error('Usage: node scripts/screenshot.mjs <url> <output.png> [--viewport=WxH] [--wait=<selector>]')
  process.exit(1)
}

let viewport = { width: 1280, height: 900 }
let waitSelector = null
for (const flag of flags) {
  if (flag.startsWith('--viewport=')) {
    const [w, h] = flag.slice('--viewport='.length).split('x').map(Number)
    if (w && h) viewport = { width: w, height: h }
  }
  if (flag.startsWith('--wait=')) {
    waitSelector = flag.slice('--wait='.length)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport })

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(String(err)))

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  if (waitSelector) await page.waitForSelector(waitSelector, { timeout: 5000 })
  await page.screenshot({ path: outPath, fullPage: true })
  console.log('Saved:', outPath)
  console.log('Title:', await page.title())
  if (consoleErrors.length > 0) {
    console.log('Console/page errors observed:')
    for (const e of consoleErrors) console.log(' -', e)
  } else {
    console.log('No console/page errors observed.')
  }
} finally {
  await browser.close()
}
