# MSI Product Scraper

Playwright scraper for one MSI product page. Extracts product data and saves it to `output/product.json`.

Target: https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI

## Install

```bash
npm install
npx playwright install chromium
npx playwright install chrome
```

## Run

```bash
npm run scrape
```

Writes/overwrites `output/product.json`.