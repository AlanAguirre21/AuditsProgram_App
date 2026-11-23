import * as evidence from '../evidence/evidence.service.js';
import * as occurrences from './occurrences.service.js';

export async function list(req, res) {
  const { items, meta } = await occurrences.list(req.query);
  res.json({ data: items, meta });
}

export async function mine(req, res) {
  res.json({ data: await occurrences.mine(req.user, req.query) });
}

export async function getDetail(req, res) {
  res.json({ data: await occurrences.getDetail(req.params.id, req.user) });
}

export async function history(req, res) {
  res.json({ data: await occurrences.history(req.params.id) });
}

export async function update(req, res) {
  res.json({ data: await occurrences.updateOwner(req.params.id, req.body, req.user) });
}

export async function complete(req, res) {
  res.json({ data: await occurrences.complete(req.params.id, req.body, req.user) });
}

export async function validate(req, res) {
  res.json({ data: await occurrences.validate(req.params.id, req.user) });
}

export async function reject(req, res) {
  res.json({ data: await occurrences.reject(req.params.id, req.body, req.user) });
}

export async function requestReschedule(req, res) {
  res.json({ data: await occurrences.requestReschedule(req.params.id, req.body, req.user) });
}

export async function approveReschedule(req, res) {
  res.json({ data: await occurrences.approveReschedule(req.params.id, req.user) });
}

export async function rejectReschedule(req, res) {
  res.json({ data: await occurrences.rejectReschedule(req.params.id, req.body, req.user) });
}

export async function reschedule(req, res) {
  res.json({ data: await occurrences.rescheduleDirect(req.params.id, req.body, req.user) });
}

export async function cancel(req, res) {
  res.json({ data: await occurrences.cancel(req.params.id, req.body, req.user) });
}

export async function closeNotDone(req, res) {
  res.json({ data: await occurrences.closeNotDone(req.params.id, req.body, req.user) });
}

export async function reopen(req, res) {
  res.json({ data: await occurrences.reopen(req.params.id, req.body, req.user) });
}

export async function uploadEvidence(req, res) {
  res.status(201).json({ data: await evidence.upload(req.params.id, req.files ?? [], req.user) });
}

export async function validationQueue(_req, res) {
  res.json({ data: await occurrences.validationQueue() });
}
