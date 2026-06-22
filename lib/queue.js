// Task queue. Backed by the "tasks" collection. Tasks carry an approval
// state so nothing leaves the building without a human saying yes.
import { db } from './db.js';
import { now } from './util.js';

const tasks = db('tasks');

export const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
};

export const APPROVAL = {
  NOT_REQUIRED: 'not_required', // internal task, runs freely
  PENDING: 'pending_approval', // produced an asset that needs a human before publishing
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const queue = {
  // Add a task. type identifies the agent, payload carries inputs.
  add(type, payload = {}, opts = {}) {
    return tasks.insert({
      type,
      payload,
      status: STATUS.PENDING,
      approval: opts.approval || APPROVAL.NOT_REQUIRED,
      priority: opts.priority ?? 5,
      agent: opts.agent || null,
      result: null,
      error: null,
    });
  },

  pending() {
    return tasks
      .find({ status: STATUS.PENDING })
      .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
  },

  awaitingApproval() {
    return tasks.find({ approval: APPROVAL.PENDING });
  },

  start(taskId) {
    tasks.update({ id: taskId }, { status: STATUS.RUNNING, started_at: now() });
  },

  complete(taskId, result, approval = null) {
    const patch = { status: STATUS.DONE, result, finished_at: now() };
    if (approval) patch.approval = approval;
    tasks.update({ id: taskId }, patch);
  },

  fail(taskId, error) {
    tasks.update({ id: taskId }, { status: STATUS.FAILED, error: String(error), finished_at: now() });
  },

  approve(taskId) {
    tasks.update({ id: taskId }, { approval: APPROVAL.APPROVED });
  },

  reject(taskId, reason = '') {
    tasks.update({ id: taskId }, { approval: APPROVAL.REJECTED, reject_reason: reason });
  },

  // Remove every task matching a predicate. Returns how many were removed.
  removeWhere(predicate) {
    const all = tasks.all();
    const keep = all.filter((t) => !predicate(t));
    tasks.replaceAll(keep);
    return all.length - keep.length;
  },

  stats() {
    const all = tasks.all();
    const by = (k, v) => all.filter((t) => t[k] === v).length;
    return {
      total: all.length,
      pending: by('status', STATUS.PENDING),
      running: by('status', STATUS.RUNNING),
      done: by('status', STATUS.DONE),
      failed: by('status', STATUS.FAILED),
      awaiting_approval: by('approval', APPROVAL.PENDING),
      approved: by('approval', APPROVAL.APPROVED),
    };
  },
};
