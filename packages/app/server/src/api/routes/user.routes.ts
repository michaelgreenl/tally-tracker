import express from 'express';
import { post, remove, login, logout, checkAuth, put, refresh } from '../controllers/user.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { emailAuthLimiter } from '../../config/limiters.config.js';
import {
    requestEmailVerification,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
} from '../controllers/email-auth.controller.js';
import {
    createUserSchema,
    emailAddressSchema,
    emailOtpSchema,
    loginSchema,
    logoutSchema,
    passwordResetSchema,
    updateUserSchema,
    refreshSchema,
} from '../schemas/user.schema.js';

const router = express.Router();

router.get('/check-auth', jwt, checkAuth);
router.post('/', emailAuthLimiter, validate(createUserSchema), post);
router.delete('/', jwt, remove);
router.put('/', jwt, validate(updateUserSchema), put);
router.post('/login', validate(loginSchema), login);
router.post('/logout', validate(logoutSchema), logout);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/verify-email/request', emailAuthLimiter, validate(emailAddressSchema), requestEmailVerification);
router.post('/verify-email', validate(emailOtpSchema), verifyEmail);
router.post('/reset-password/request', emailAuthLimiter, validate(emailAddressSchema), requestPasswordReset);
router.post('/reset-password', validate(passwordResetSchema), resetPassword);

export default router;
