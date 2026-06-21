// Directory Discovery Agent (Phase 5)
//
// Maintains the master list of places where Vynix can be listed for backlinks
// and discovery: AI tool directories, SaaS and startup directories, developer
// communities, browser-extension stores, and MCP registries. The agent starts
// from a curated seed of well-known, real directories and records each one with
// the fields the submission agent needs.
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { slug } from '../lib/util.js';

const log = logger('directory-discovery');
const store = db('directories');

export const meta = { id: 'directory-discovery', name: 'Directory Discovery Agent' };

// A curated seed of real directories. Authority is a rough 0-100 estimate used
// only for prioritisation, not a precise metric.
const SEED = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com', submit: 'https://www.producthunt.com/posts/new', category: 'startup', authority: 90 },
  { name: 'BetaList', url: 'https://betalist.com', submit: 'https://betalist.com/submit', category: 'startup', authority: 72 },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com', submit: 'https://www.indiehackers.com/products', category: 'startup', authority: 78 },
  { name: 'SaaSHub', url: 'https://www.saashub.com', submit: 'https://www.saashub.com/submit', category: 'saas', authority: 65 },
  { name: 'AlternativeTo', url: 'https://alternativeto.net', submit: 'https://alternativeto.net/manage/submit-app/', category: 'saas', authority: 80 },
  { name: 'G2', url: 'https://www.g2.com', submit: 'https://www.g2.com/products/new', category: 'saas', authority: 92 },
  { name: 'Capterra', url: 'https://www.capterra.com', submit: 'https://www.capterra.com/vendors/sign-up', category: 'saas', authority: 90 },
  { name: 'GetApp', url: 'https://www.getapp.com', submit: 'https://www.getapp.com/list-your-software/', category: 'saas', authority: 85 },
  { name: 'Slant', url: 'https://www.slant.co', submit: 'https://www.slant.co', category: 'saas', authority: 70 },
  { name: 'StackShare', url: 'https://stackshare.io', submit: 'https://stackshare.io/tools/new', category: 'developer', authority: 78 },
  { name: 'Dev Hunt', url: 'https://devhunt.org', submit: 'https://devhunt.org/new-tool', category: 'developer', authority: 55 },
  { name: 'Awesome Lists (GitHub)', url: 'https://github.com/topics/awesome', submit: 'https://github.com/topics/awesome', category: 'developer', authority: 88 },
  { name: 'Chrome Web Store', url: 'https://chromewebstore.google.com', submit: 'https://chrome.google.com/webstore/devconsole', category: 'extension', authority: 95 },
  { name: 'Microsoft Edge Add-ons', url: 'https://microsoftedge.microsoft.com/addons', submit: 'https://partner.microsoft.com/dashboard/microsoftedge/', category: 'extension', authority: 90 },
  { name: 'Firefox Add-ons', url: 'https://addons.mozilla.org', submit: 'https://addons.mozilla.org/developers/', category: 'extension', authority: 90 },
  { name: "There's An AI For That", url: 'https://theresanaiforthat.com', submit: 'https://theresanaiforthat.com/submit/', category: 'ai', authority: 80 },
  { name: 'Futurepedia', url: 'https://www.futurepedia.io', submit: 'https://www.futurepedia.io/submit-tool', category: 'ai', authority: 75 },
  { name: 'Future Tools', url: 'https://www.futuretools.io', submit: 'https://www.futuretools.io/submit-a-tool', category: 'ai', authority: 70 },
  { name: 'AI Tool Hunt', url: 'https://www.aitoolhunt.com', submit: 'https://www.aitoolhunt.com/submit', category: 'ai', authority: 55 },
  { name: 'Toolify', url: 'https://www.toolify.ai', submit: 'https://www.toolify.ai/submit', category: 'ai', authority: 60 },
  { name: 'MCP Servers Directory', url: 'https://mcpservers.org', submit: 'https://mcpservers.org/submit', category: 'mcp', authority: 50 },
  { name: 'Awesome MCP Servers', url: 'https://github.com/punkpeye/awesome-mcp-servers', submit: 'https://github.com/punkpeye/awesome-mcp-servers', category: 'mcp', authority: 65 },
  { name: 'Glama MCP Directory', url: 'https://glama.ai/mcp/servers', submit: 'https://glama.ai/mcp/servers', category: 'mcp', authority: 55 },
  { name: 'SaaSworthy', url: 'https://www.saasworthy.com', submit: 'https://www.saasworthy.com/get-listed', category: 'saas', authority: 62 },
  { name: 'Crozdesk', url: 'https://crozdesk.com', submit: 'https://vendors.crozdesk.com', category: 'saas', authority: 60 },
  { name: 'Startup Stash', url: 'https://startupstash.com', submit: 'https://startupstash.com/add-listing/', category: 'startup', authority: 64 },
  { name: 'SideProjectors', url: 'https://www.sideprojectors.com', submit: 'https://www.sideprojectors.com/project/submit', category: 'startup', authority: 50 },
  { name: 'Uneed', url: 'https://www.uneed.best', submit: 'https://www.uneed.best/submit-a-tool', category: 'startup', authority: 52 },
  { name: 'Hacker News (Show HN)', url: 'https://news.ycombinator.com', submit: 'https://news.ycombinator.com/submit', category: 'developer', authority: 92 },
  { name: 'Reddit r/SideProject', url: 'https://www.reddit.com/r/SideProject', submit: 'https://www.reddit.com/r/SideProject/submit', category: 'developer', authority: 90 },
  { name: 'Software Advice', url: 'https://www.softwareadvice.com', submit: 'https://www.softwareadvice.com/vendors/', category: 'saas', authority: 88 },
  { name: 'TrustRadius', url: 'https://www.trustradius.com', submit: 'https://www.trustradius.com/vendors', category: 'saas', authority: 85 },
  { name: 'SourceForge', url: 'https://sourceforge.net', submit: 'https://sourceforge.net/create/', category: 'developer', authority: 90 },
  { name: 'AppSumo', url: 'https://appsumo.com', submit: 'https://sell.appsumo.com', category: 'saas', authority: 82 },
  { name: 'Launching Next', url: 'https://www.launchingnext.com', submit: 'https://www.launchingnext.com/submit/', category: 'startup', authority: 55 },
  { name: 'BetaPage', url: 'https://betapage.co', submit: 'https://betapage.co/submit-startup', category: 'startup', authority: 56 },
  { name: 'Startup Buffer', url: 'https://startupbuffer.com', submit: 'https://startupbuffer.com/site/submit', category: 'startup', authority: 52 },
  { name: 'Fazier', url: 'https://fazier.com', submit: 'https://fazier.com/submit', category: 'startup', authority: 55 },
  { name: 'Microlaunch', url: 'https://microlaunch.net', submit: 'https://microlaunch.net/submit', category: 'startup', authority: 50 },
  { name: 'Peerlist', url: 'https://peerlist.io', submit: 'https://peerlist.io', category: 'developer', authority: 66 },
  { name: 'AI Scout', url: 'https://aiscout.net', submit: 'https://aiscout.net/submit', category: 'ai', authority: 55 },
  { name: 'Dang.ai', url: 'https://dang.ai', submit: 'https://dang.ai/submit', category: 'ai', authority: 55 },
  { name: 'TopAI.tools', url: 'https://topai.tools', submit: 'https://topai.tools/submit', category: 'ai', authority: 55 },
  { name: 'aitools.fyi', url: 'https://aitools.fyi', submit: 'https://aitools.fyi/submit-tool', category: 'ai', authority: 52 },
  { name: 'Insidr AI Tools', url: 'https://www.insidr.ai', submit: 'https://www.insidr.ai/submit-tool/', category: 'ai', authority: 52 },
  { name: 'OpenAlternative', url: 'https://openalternative.co', submit: 'https://openalternative.co/submit', category: 'developer', authority: 68 },
  { name: 'Land-book', url: 'https://land-book.com', submit: 'https://land-book.com/submit', category: 'design', authority: 62 },
];

export async function run() {
  let added = 0;
  let updated = 0;
  for (const d of SEED) {
    const key = slug(d.name);
    const existing = store.findOne({ key });
    const record = store.upsert(
      {
        key,
        name: d.name,
        url: d.url,
        submit_url: d.submit,
        category: d.category,
        authority: d.authority,
        status: existing?.status || 'discovered', // discovered -> prepared -> submitted -> approved/rejected
        requirements: existing?.requirements || 'Account required. Provide name, descriptions, logo, screenshots, and a link.',
        notes: existing?.notes || '',
      },
      'key',
    );
    if (existing) updated += 1;
    else added += 1;
    void record;
  }
  log.info(`directory list maintained`, { total: store.all().length, added, updated });
  return { total: store.all().length, added, updated };
}

export default { meta, run };
