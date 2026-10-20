# MSI Product Scraper

A small Playwright-based scraper that extracts structured product data from a
single MSI product detail page and saves it as JSON.

Target page: https://us-store.msi.com/Motherboards/Intel-Platform-Motherboard/INTEL-Z890/MAG-Z890-TOMAHAWK-WIFI

## Requirements

- Node.js 18+
- npm

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
npm run scrape
```

This opens the product page in headless Chromium, extracts the data below,
and writes the result to `output/product.json` (created or overwritten on
every run).

## Where each field comes from

The site (an OpenCart-based store) does not expose JSON-LD or
`itemprop`/`og:` structured data on this page, so fields are read directly
from the rendered DOM.

| Field | Source |
|---|---|
| `url` | Final page URL after navigation (`page.url()`) |
| `item_id` | Hidden `input[name="product_id"]` in the buy box |
| `title` | Product name heading (`h2.crop-text-2.title`) |
| `brand` | First word of the `<meta name="keywords">` content (always starts with the manufacturer name, e.g. "MSI") |
| `product_category` / `category_tree` | Breadcrumb trail (`ol.breadcrumb`), excluding the leading "Home" link and the trailing active item (the product itself) |
| `description` | Paragraph right below the title heading |
| `price` / `sale_price` | All `$`-prefixed amounts found inside the price box; if two amounts are present the higher one is `price` and the lower one is `sale_price`, otherwise only `price` is set |
| `availability` | Keyword match ("in stock" / "add to cart", "out of stock" / "notify me", "pre-order") over the text of the price box and the buy-box buttons |
| `image_url` | `src` of the large preview image (`#imagePopup`) |
| `additional_image_urls` | `popup_img` attribute of the thumbnail gallery images, de-duplicated and excluding the main image |
| `specs` | Rows of the two "Detail Specification" tables (`th` = name, `td` = value) |
| `star_rating` / `review_count` | Parsed from the "4.7 (3)" style rating summary text |
| `gtin` | Not available anywhere on the page → `null` |
| `mpn` | Value of the "Manufacturer Number" row in the specs table |
| `scraped_at` | `new Date().toISOString()` at scrape time |

## Known limitations

- **No GTIN on the page.** MSI does not publish a UPC/EAN/GTIN for this
  product anywhere in the HTML, so the field is always `null`.
- **`brand` is inferred, not labelled.** There is no dedicated brand field on
  the page; it is derived from the first word of the page's `keywords` meta
  tag, which happens to always be the manufacturer name on this site.
- **`meta[name="description"]` is unreliable on this page** — in testing it
  contained text for a different MSI product, so the actual on-page
  description paragraph is used instead.
- **Availability is text-based**, since the page has no `schema.org`
  availability data. It relies on matching English phrases such as
  "out of stock" / "add to cart" / "pre-order"; if MSI changes this wording
  the mapping in `normalizeAvailability` (in `src/helpers.js`) may need an
  update.
- **Price/sale price detection is amount-based**, not class-based: it reads
  all dollar amounts inside the price box and treats the larger one as the
  regular price and the smaller one as the sale price. This was chosen
  because the page markup for a "was/now" price pair was not observed on a
  live in-stock item at the time of writing.
- The scraper targets this single product page layout; it is not a generic
  MSI store scraper.
