import { Group } from '../groups/group.model.js';
import { getSettings } from '../settings/settings.service.js';
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
  const [groups, settings] = await Promise.all([Group.find({ memberIds: req.user._id, active: true }, { name: 1 }).lean(), getSettings()]);
  // `features` lets the UI show options that depend on global settings (e.g. the email copy).
  res.json({ data: { ...auth.publicUser(req.user), groups, features: { emailEnabled: Boolean(settings.emailEnabled) } } });
}
