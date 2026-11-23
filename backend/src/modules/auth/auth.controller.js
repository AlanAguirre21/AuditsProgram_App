import { Group } from '../groups/group.model.js';
import * as auth from './auth.service.js';

export async function register(req, res) {
  res.status(201).json({ data: await auth.register(req.body) });
}

export async function login(req, res) {
  res.json({ data: await auth.login(req.body, req.ip) });
}

export async function verify(req, res) {
  res.json({ data: await auth.verifyLogin(req.body) });
}

export async function resend(req, res) {
  res.json({ data: await auth.resendLogin(req.body, req.ip) });
}

export async function forgotPassword(req, res) {
  res.json({ data: await auth.forgotPassword(req.body, req.ip) });
}

export async function resetPassword(req, res) {
  res.json({ data: await auth.resetPassword(req.body) });
}

export async function changePassword(req, res) {
  res.json({ data: await auth.changePassword(req.user._id, req.body) });
}

export async function me(req, res) {
  const groups = await Group.find({ memberIds: req.user._id, active: true }, { name: 1 }).lean();
  res.json({ data: { ...auth.publicUser(req.user), groups } });
}
