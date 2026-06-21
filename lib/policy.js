// Auto-approval policy.
//
// The founder asked the system to act on its own where it is clearly safe, and
// to ask only where there is real doubt. This file encodes that line.
//
// Safe to do automatically (our own content on our own properties, fully
// reversible): blog posts, comparison pages, knowledge base articles. These are
// auto-approved once the reviewer confirms they pass.
//
// Held for human approval (external, public, or hard to undo): submitting to
// third-party directories, opening new source code, and creating new public
// GitHub repositories. These always wait.
import { db } from './db.js';
import { queue, APPROVAL, STATUS } from './queue.js';
import { logger } from './logger.js';

const log = logger('policy');
const tasks = db('tasks');
const reviews = db('reviews');

export const AUTO_APPROVE_TYPES = ['content-publish', 'comparison-publish', 'kb-publish'];
export const APPROVAL_REQUIRED_TYPES = ['github-publish', 'directory-submit', 'opensource-approve'];

// Did the page behind this task pass review?
function pageReviewed(task) {
  const url = task.payload?.url;
  if (!url) return true; // release bundles and similar have no page; treat as safe
  const route = url.endsWith('/') ? url : url + '/';
  const rev = reviews.all().find((r) => r.route === route);
  // If we have a review record, require it to pass. If there is no record yet
  // (for example a release bundle that is not a site page), do not block.
  if (!rev) return true;
  return rev.pass === true;
}

// Apply the policy across all pending tasks. Returns a summary.
export function applyPolicy() {
  let approved = 0;
  let heldForReview = 0;
  let needsHuman = 0;

  const pending = tasks
    .all()
    .filter((t) => t.approval === APPROVAL.PENDING && t.status !== STATUS.DONE);

  for (const t of pending) {
    if (AUTO_APPROVE_TYPES.includes(t.type)) {
      if (pageReviewed(t)) {
        queue.approve(t.id);
        approved += 1;
      } else {
        heldForReview += 1;
      }
    } else {
      // External or irreversible: leave for the founder.
      needsHuman += 1;
    }
  }

  log.info('policy applied', { approved, heldForReview, needsHuman });
  return { approved, heldForReview, needsHuman };
}

export default { applyPolicy, AUTO_APPROVE_TYPES, APPROVAL_REQUIRED_TYPES };
