function normalizeWhitespace(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parsePrice(value) {
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) ? num : null;
}

// Within the price area, there can be one amount (regular price) or two
// (an original price and a discounted price). The larger amount is always
// the regular price and the smaller one is the sale price.
function parsePricePair(text) {
  if (typeof text !== 'string') return { price: null, salePrice: null };
  const matches = text.match(/\$\s?-?[\d,]+(?:\.\d+)?/g) || [];
  const amounts = matches
    .map((m) => parsePrice(m))
    .filter((n) => n !== null)
    .sort((a, b) => b - a);

  if (amounts.length === 0) return { price: null, salePrice: null };
  if (amounts.length === 1) return { price: amounts[0], salePrice: null };
  return { price: amounts[0], salePrice: amounts[1] };
}

function normalizeAvailability(text) {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase();
  if (t.includes('pre-order') || t.includes('pre order') || t.includes('preorder')) return 'pre_order';
  if (t.includes('out of stock') || t.includes('sold out') || t.includes('notify me')) return 'out_of_stock';
  if (t.includes('in stock') || t.includes('add to cart')) return 'in_stock';
  return null;
}

function toAbsoluteUrl(value, baseUrl) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    return new URL(value.trim(), baseUrl).toString();
  } catch (err) {
    return null;
  }
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function dedupeSpecs(specs) {
  const seen = new Set();
  const result = [];
  for (const spec of specs) {
    const name = normalizeWhitespace(spec && spec.name);
    const value = normalizeWhitespace(spec && spec.value);
    if (!name || !value) continue;
    const key = `${name}::${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, value });
  }
  return result;
}

function parseRating(text) {
  if (typeof text !== 'string') return { starRating: null, reviewCount: null };
  const ratingMatch = text.match(/(\d+(\.\d+)?)/);
  const countMatch = text.match(/\((\d+)\)/);
  const starRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  const reviewCount = countMatch ? parseInt(countMatch[1], 10) : null;
  return {
    starRating: Number.isFinite(starRating) ? starRating : null,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : null,
  };
}

function extractBrand(keywordsContent) {
  const normalized = normalizeWhitespace(keywordsContent);
  if (!normalized) return null;
  const firstSegment = normalized.split(',')[0];
  const firstWord = firstSegment.trim().split(/\s+/)[0];
  return firstWord || null;
}

function buildCategoryTree(breadcrumbItems) {
  if (!Array.isArray(breadcrumbItems) || breadcrumbItems.length === 0) return [];

  let items = breadcrumbItems.filter((item) => item && normalizeWhitespace(item.name));

  if (items.length > 0 && normalizeWhitespace(items[0].name).toLowerCase() === 'home') {
    items = items.slice(1);
  }
  if (items.length > 0 && items[items.length - 1].isActive) {
    items = items.slice(0, -1);
  }

  return items.map((item) => ({
    name: normalizeWhitespace(item.name),
    url: item.url || null,
  }));
}

module.exports = {
  normalizeWhitespace,
  parsePrice,
  parsePricePair,
  normalizeAvailability,
  toAbsoluteUrl,
  dedupeStrings,
  dedupeSpecs,
  parseRating,
  extractBrand,
  buildCategoryTree,
};
