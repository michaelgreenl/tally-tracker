import express from 'express';
import { get, post, remove, login, logout, checkAuth, put } from '../controllers/user.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
    createUserSchema,
    loginSchema,
    updateUserSchema,
    deleteUserSchema,
    getUsersSchema,
} from '../schemas/user.schema.js';

const router = express.Router();

router.get('/', jwt, validate(getUsersSchema), get);
router.post('/', validate(createUserSchema), post);

router.get('/check-auth', checkAuth);

router.delete('/:userId', jwt, validate(deleteUserSchema), remove);
router.put('/:userId', jwt, validate(updateUserSchema), put);

router.post('/auth', validate(createUserSchema), post);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);

export default router;
