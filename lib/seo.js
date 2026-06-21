// SEO helpers. Builds the head tags and JSON-LD structured data that search
// engines use. Good structured data plus genuinely useful, unique content is
// what keeps pages out of trouble with Google and SEO audits. None of this is
// keyword stuffing: the schema simply describes the page accurately.
import { product } from './vynix-facts.js';
import { env } from './config.js';

// The canonical host for the generated pages. Defaults to the Vynix domain, but
// can be pointed at wherever the site is actually hosted (for example a GitHub
// Pages URL) so canonicals are self-referencing and never point at a URL that
// shows different content — which is what avoids duplicate-content penalties.
const SITE = (env('SITE_CANONICAL_BASE', product.website) || product.website).replace(/\/+$/, '');
const ORG_NAME = 'Vynix';
const ORG_LOGO = `${product.website}/icon-512.png`;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Absolute URL for a site-relative path.
export function abs(pathname) {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${SITE}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

// The <head> meta block: title, description, canonical, robots, Open Graph,
// Twitter card. Keep titles under ~60 chars and descriptions under ~160.
export function headMeta({ title, description, canonical, ogImage, type = 'website', published, modified, keywords }) {
  const url = abs(canonical);
  const img = ogImage ? abs(ogImage) : abs('/og.png');
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    keywords ? `<meta name="keywords" content="${esc(keywords)}" />` : '',
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<meta property="og:type" content="${esc(type)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:site_name" content="Vynix" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@usevynix" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    published ? `<meta property="article:published_time" content="${esc(published)}" />` : '',
    modified ? `<meta property="article:modified_time" content="${esc(modified)}" />` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function jsonLd(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

export function organizationLd() {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: SITE,
    logo: ORG_LOGO,
    sameAs: ['https://github.com/vynix-in', 'https://twitter.com/usevynix'],
  });
}

export function softwareApplicationLd() {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Vynix',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: product.what,
    url: SITE,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free plan available' },
  });
}

export function breadcrumbLd(items) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.url),
    })),
  });
}

export function articleLd({ title, description, canonical, image, published, modified, author = 'The Vynix Team' }) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: image ? [abs(image)] : [abs('/og.png')],
    datePublished: published,
    dateModified: modified || published,
    author: { '@type': 'Organization', name: author, url: SITE },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(canonical) },
  });
}

export function faqLd(faqs) {
  if (!faqs || !faqs.length) return '';
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}

export function videoLd({ name, description, thumbnail, contentUrl, uploadDate }) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: [abs(thumbnail)],
    contentUrl: abs(contentUrl),
    uploadDate,
  });
}
