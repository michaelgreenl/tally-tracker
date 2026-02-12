import express from 'express';
import { post, remove, login, logout, checkAuth, put, refresh } from '../controllers/user.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createUserSchema, loginSchema, updateUserSchema, refreshSchema } from '../schemas/user.schema.js';

const router = express.Router();

router.get('/check-auth', jwt, checkAuth);
router.post('/', validate(createUserSchema), post);
router.delete('/', jwt, remove);
router.put('/', jwt, validate(updateUserSchema), put);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', validate(refreshSchema), refresh);

export default router;
