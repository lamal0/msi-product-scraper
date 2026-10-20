const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  normalizeWhitespace,
  parsePricePair,
  normalizeAvailability,
  toAbsoluteUrl,
  dedupeStrings,
  dedupeSpecs,
  parseRating,
  extractBrand,
  buildCategoryTree,
} = require('./helpers');

const PRODUCT_URL =
  'https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI';
const OUTPUT_PATH = path.join(__dirname, '..', 'output', 'product.json');

async function dismissPopups(page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("I Agree")',
    '#hs-eu-cookie-confirmation-button',
    '[aria-label="Close"]',
  ];
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click({ timeout: 2000 });
      }
    } catch (err) {
      // Popup not present or not clickable in time; safe to continue.
    }
  }
}

function extractRawData() {
  const breadcrumb = Array.from(document.querySelectorAll('ol.breadcrumb li.breadcrumb-item')).map((li) => {
    const a = li.querySelector('a');
    return {
      name: (a ? a.textContent : li.textContent) || '',
      url: a ? a.getAttribute('href') : null,
      isActive: li.classList.contains('active'),
    };
  });

  const titleEl = document.querySelector('h2.crop-text-2.title');
  const titleRaw = titleEl ? titleEl.textContent : null;

  let descriptionRaw = null;
  if (titleEl && titleEl.nextElementSibling) {
    const p = titleEl.nextElementSibling.querySelector('p');
    descriptionRaw = p ? p.textContent : titleEl.nextElementSibling.textContent;
  }

  const priceWrapper = document.querySelector('#prices-wrapper');
  const priceWrapperText = priceWrapper ? priceWrapper.textContent : '';

  const productQty = document.querySelector('#product_qty');
  const productQtyText = productQty ? productQty.textContent : '';
  const productIdInput = productQty ? productQty.querySelector('input[name="product_id"]') : null;
  const itemIdRaw = productIdInput ? productIdInput.value : null;

  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const keywordsContent = metaKeywords ? metaKeywords.getAttribute('content') : null;

  const imageEl = document.querySelector('#imagePopup');
  const imageUrlRaw = imageEl ? imageEl.getAttribute('src') : null;

  const galleryUrlsRaw = Array.from(document.querySelectorAll('.product-detail-thumb-bto'))
    .map((img) => img.getAttribute('popup_img'))
    .filter(Boolean);

  const specsRaw = Array.from(document.querySelectorAll('table.table.table-borderless tr')).map((tr) => {
    const th = tr.querySelector('th');
    const td = tr.querySelector('td');
    return {
      name: th ? th.textContent : '',
      value: td ? td.innerText : '',
    };
  });

  const ratingEl = document.querySelector('#average-rating-info');
  const ratingText = ratingEl ? ratingEl.textContent : null;

  return {
    breadcrumb,
    titleRaw,
    descriptionRaw,
    priceWrapperText,
    productQtyText,
    itemIdRaw,
    keywordsContent,
    imageUrlRaw,
    galleryUrlsRaw,
    specsRaw,
    ratingText,
  };
}

function buildProduct(raw, finalUrl) {
  const { price, salePrice } = parsePricePair(raw.priceWrapperText);
  const availability = normalizeAvailability(`${raw.priceWrapperText} ${raw.productQtyText}`);
  const { starRating, reviewCount } = parseRating(raw.ratingText);

  const category_tree = buildCategoryTree(raw.breadcrumb).map((item) => ({
    name: item.name,
    url: toAbsoluteUrl(item.url, finalUrl),
  }));
  const product_category = category_tree.length > 0 ? category_tree.map((c) => c.name).join(' > ') : null;

  const image_url = toAbsoluteUrl(raw.imageUrlRaw, finalUrl);
  const additional_image_urls = dedupeStrings(
    raw.galleryUrlsRaw.map((url) => toAbsoluteUrl(url, finalUrl)).filter(Boolean)
  ).filter((url) => url !== image_url);

  const specs = dedupeSpecs(raw.specsRaw);
  const mpnSpec = specs.find((spec) => spec.name.toLowerCase() === 'manufacturer number');

  return {
    url: finalUrl,
    item_id: normalizeWhitespace(raw.itemIdRaw),
    title: normalizeWhitespace(raw.titleRaw),
    brand: extractBrand(raw.keywordsContent),
    product_category,
    category_tree,
    description: normalizeWhitespace(raw.descriptionRaw),
    price,
    sale_price: salePrice,
    availability,
    image_url,
    additional_image_urls,
    specs,
    star_rating: starRating,
    review_count: reviewCount,
    gtin: null,
    mpn: mpnSpec ? mpnSpec.value : null,
    scraped_at: new Date().toISOString(),
  };
}

async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  };
  try {
    // Prefer the real, locally installed Chrome: its network/TLS fingerprint
    // matches a normal browser, which the target site's bot protection
    // otherwise flags and blocks when using Playwright's bundled Chromium.
    return await chromium.launch({ ...launchOptions, channel: 'chrome' });
  } catch (err) {
    console.warn('Google Chrome channel not available, falling back to bundled Chromium.');
    return chromium.launch(launchOptions);
  }
}

async function scrapeProduct() {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();

    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissPopups(page);
    await page.waitForSelector('h2.crop-text-2.title', { timeout: 30000 });

    const raw = await page.evaluate(extractRawData);
    const product = buildProduct(raw, page.url());

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(product, null, 2), 'utf-8');

    console.log(`Saved product data to ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

scrapeProduct().catch((err) => {
  console.error('Failed to scrape product page:', err.message);
  process.exit(1);
});
