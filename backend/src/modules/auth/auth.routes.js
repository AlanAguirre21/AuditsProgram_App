import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ctrl from './auth.controller.js';
import * as v from './auth.validation.js';

const router = Router();

const limiter = (max, windowMinutes, byEmail = false) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: env.isTest ? 1000 : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${byEmail ? String(req.body?.email || '').toLowerCase() : ''}`,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Intenta más tarde.', details: {} } }),
  });

// Spec 14.3: 5 login attempts / 15 min per IP + email.
router.post('/login', limiter(5, 15, true), validate({ body: v.loginBody }), asyncHandler(ctrl.login));
router.post('/register', limiter(10, 60), validate({ body: v.registerBody }), asyncHandler(ctrl.register));
router.post('/2fa/verify', limiter(15, 15), validate({ body: v.verifyBody }), asyncHandler(ctrl.verify));
router.post('/2fa/resend', limiter(5, 15), validate({ body: v.resendBody }), asyncHandler(ctrl.resend));
router.post('/forgot-password', limiter(5, 15, true), validate({ body: v.forgotBody }), asyncHandler(ctrl.forgotPassword));
router.post('/reset-password', limiter(10, 15, true), validate({ body: v.resetBody }), asyncHandler(ctrl.resetPassword));

router.get('/me', authenticate, asyncHandler(ctrl.me));
router.post('/change-password', authenticate, validate({ body: v.changePasswordBody }), asyncHandler(ctrl.changePassword));

export default router;
