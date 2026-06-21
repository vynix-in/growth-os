// Backlinks and Outreach Agent
//
// Backlinks and mentions from places developers trust are what move domain
// authority. This keeps a curated list of real outreach targets: developer
// communities, newsletters that feature tools, podcasts, and sites that accept
// guest posts. Each entry has what to do and a status, so the founder can work
// through them. Reaching out is a human action, so these wait for approval.
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { slug } from '../lib/util.js';

const log = logger('backlinks');
const store = db('backlinks');

export const meta = { id: 'backlinks', name: 'Backlinks and Outreach Agent' };

// Real, well-known targets. Authority is a rough 0-100 estimate for ordering.
const SEED = [
  { name: 'dev.to', url: 'https://dev.to', type: 'community', authority: 90, action: 'Cross-post articles with a canonical URL back to the blog.' },
  { name: 'Hashnode', url: 'https://hashnode.com', type: 'community', authority: 82, action: 'Cross-post articles, set the canonical URL, join relevant series.' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com', type: 'community', authority: 92, action: 'Share a strong post or a Show HN during US morning hours.' },
  { name: 'Reddit r/webdev', url: 'https://www.reddit.com/r/webdev', type: 'community', authority: 90, action: 'Share genuinely useful posts, follow self-promo rules, reply to comments.' },
  { name: 'Reddit r/SideProject', url: 'https://www.reddit.com/r/SideProject', type: 'community', authority: 88, action: 'Share build updates and ask for feedback.' },
  { name: 'Lobsters', url: 'https://lobste.rs', type: 'community', authority: 78, action: 'Submit deep technical posts if you have an invite.' },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com', type: 'community', authority: 80, action: 'Post the product, write a build-in-public update, join discussions.' },
  { name: 'Hackernoon', url: 'https://hackernoon.com', type: 'guest-post', authority: 84, action: 'Submit a guest article with a link back to Vynix.' },
  { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/write-for-us/', type: 'guest-post', authority: 90, action: 'Pitch a front-end or feedback workflow article.' },
  { name: 'CSS-Tricks', url: 'https://css-tricks.com', type: 'guest-post', authority: 88, action: 'Pitch a practical article tied to the blog content.' },
  { name: 'LogRocket Blog', url: 'https://blog.logrocket.com/become-a-logrocket-guest-author/', type: 'guest-post', authority: 85, action: 'Apply as a guest author and link back where relevant.' },
  { name: 'TLDR Newsletter', url: 'https://tldr.tech', type: 'newsletter', authority: 80, action: 'Submit a tool or a strong post for inclusion.' },
  { name: 'Console.dev', url: 'https://console.dev', type: 'newsletter', authority: 72, action: 'Submit Vynix as a developer tool worth featuring.' },
  { name: 'Bytes (JavaScript)', url: 'https://bytes.dev', type: 'newsletter', authority: 74, action: 'Reach out to be featured.' },
  { name: 'Pointer.io', url: 'https://www.pointer.io', type: 'newsletter', authority: 70, action: 'Pitch a thoughtful engineering post.' },
  { name: 'The Changelog Podcast', url: 'https://changelog.com', type: 'podcast', authority: 82, action: 'Pitch the founder story or the AI-feedback angle.' },
  { name: 'Syntax.fm', url: 'https://syntax.fm', type: 'podcast', authority: 80, action: 'Pitch a topic on feedback workflows for web teams.' },
  { name: 'Awesome DevTools (GitHub)', url: 'https://github.com/topics/devtools', type: 'list', authority: 80, action: 'Get added to relevant awesome lists with a short description.' },
  { name: 'Awesome MCP Servers', url: 'https://github.com/punkpeye/awesome-mcp-servers', type: 'list', authority: 65, action: 'Add the Vynix MCP server with a one-line description.' },
  { name: 'Openalternative.co', url: 'https://openalternative.co', type: 'list', authority: 68, action: 'List Vynix and its open-source tooling.' },
  { name: 'Peerlist', url: 'https://peerlist.io', type: 'community', authority: 66, action: 'Share the project and updates.' },
  { name: 'Hashnode Townhall / DevHunt', url: 'https://devhunt.org', type: 'launch', authority: 55, action: 'Launch the developer tools.' },
  { name: 'Tiny Startups', url: 'https://www.tinystartups.com', type: 'newsletter', authority: 58, action: 'Submit for a feature.' },
  { name: 'Hackerverse / GitHub Trending', url: 'https://github.com/trending', type: 'list', authority: 88, action: 'Push for stars on the open-source repos to reach trending.' },
  { name: 'Awesome Selfhosted / Awesome lists', url: 'https://github.com/topics/awesome', type: 'list', authority: 85, action: 'Open a PR to add Vynix to relevant awesome lists with a one-line description.' },
  { name: 'StackShare', url: 'https://stackshare.io', type: 'community', authority: 78, action: 'Add Vynix to the stack and write a short why.' },
  { name: 'DEV Community tags', url: 'https://dev.to/t/devtools', type: 'community', authority: 88, action: 'Post in the devtools, webdev and ai tags with canonical links.' },
  { name: 'Hashnode team blog', url: 'https://hashnode.com', type: 'community', authority: 82, action: 'Publish the engineering posts on a Hashnode publication.' },
  { name: 'Medium publications', url: 'https://medium.com', type: 'guest-post', authority: 86, action: 'Republish with a canonical link in relevant publications (Better Programming, Level Up Coding).' },
  { name: 'freeCodeCamp News', url: 'https://www.freecodecamp.org/news/', type: 'guest-post', authority: 90, action: 'Pitch a practical tutorial that mentions Vynix naturally.' },
  { name: 'Dev.to listicles round-ups', url: 'https://dev.to', type: 'mention', authority: 88, action: 'Reach out to authors of best-devtools round-ups to be considered.' },
  { name: 'Product Hunt discussions', url: 'https://www.producthunt.com/discussions', type: 'community', authority: 90, action: 'Answer relevant questions where Vynix is a genuine fit.' },
  { name: 'IndieHackers groups', url: 'https://www.indiehackers.com/groups', type: 'community', authority: 80, action: 'Share build updates in developer and SaaS groups.' },
  { name: 'Reddit r/programming', url: 'https://www.reddit.com/r/programming', type: 'community', authority: 90, action: 'Share genuinely useful deep posts, follow the rules, no spam.' },
  { name: 'Wikipedia (Model Context Protocol)', url: 'https://en.wikipedia.org', type: 'reference', authority: 95, action: 'Only if Vynix becomes a notable, citable MCP implementation, add a sourced reference. Do not spam.' },
];

export async function run() {
  let added = 0;
  let updated = 0;
  for (const t of SEED) {
    const key = slug(t.name);
    const existing = store.findOne({ key });
    store.upsert(
      {
        key,
        name: t.name,
        url: t.url,
        type: t.type,
        authority: t.authority,
        action: t.action,
        status: existing?.status || 'todo', // todo -> contacted -> live
        notes: existing?.notes || '',
      },
      'key',
    );
    if (existing) updated += 1;
    else added += 1;
  }
  log.info('backlink targets maintained', { total: store.all().length, added, updated });
  return { total: store.all().length, added, updated };
}

export default { meta, run };
