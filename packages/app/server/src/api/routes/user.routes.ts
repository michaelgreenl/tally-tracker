import express from 'express';
import { post, remove, login, logout, checkAuth, refresh, signInMethods } from '../controllers/user.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { googleLogin, verifyGoogle, connectGoogle } from '../controllers/google-auth.controller.js';
import { appleLogin, appleNotification, connectApple, verifyApple } from '../controllers/apple-auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { emailAuthLimiter, loginAccountLimiter, loginIpLimiter } from '../../config/limiters.config.js';
import {
    requestEmailVerification,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    verifyPasswordResetCode,
} from '../controllers/email-auth.controller.js';
import {
    createUserSchema,
    emailAddressSchema,
    emailOtpSchema,
    loginSchema,
    googleLoginSchema,
    appleLoginSchema,
    appleNotificationSchema,
    logoutSchema,
    passwordResetSchema,
    refreshSchema,
} from '../schemas/user.schema.js';

const router = express.Router();

router.get('/check-auth', jwt, checkAuth);
router.post('/', emailAuthLimiter, validate(createUserSchema), post);
router.delete('/', jwt, remove);
router.post('/login', loginIpLimiter, validate(loginSchema), loginAccountLimiter, login);
router.post('/google', loginIpLimiter, validate(googleLoginSchema), verifyGoogle, loginAccountLimiter, googleLogin);
router.post('/apple', loginIpLimiter, validate(appleLoginSchema), verifyApple, loginAccountLimiter, appleLogin);
router.get('/sign-in-methods', jwt, signInMethods);
router.post(
    '/google/connect',
    jwt,
    loginIpLimiter,
    validate(googleLoginSchema),
    verifyGoogle,
    loginAccountLimiter,
    connectGoogle,
);
router.post(
    '/apple/connect',
    jwt,
    loginIpLimiter,
    validate(appleLoginSchema),
    verifyApple,
    loginAccountLimiter,
    connectApple,
);
router.post('/apple/notifications', validate(appleNotificationSchema), appleNotification);
router.post('/logout', validate(logoutSchema), logout);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/verify-email/request', emailAuthLimiter, validate(emailAddressSchema), requestEmailVerification);
router.post('/verify-email', validate(emailOtpSchema), verifyEmail);
router.post('/reset-password/request', emailAuthLimiter, validate(emailAddressSchema), requestPasswordReset);
router.post('/reset-password/verify', validate(emailOtpSchema), verifyPasswordResetCode);
router.post('/reset-password', validate(passwordResetSchema), resetPassword);

export default router;
