import express from 'express';
import { getAllByUser, post, remove, put, increment, join, removeShare } from '../controllers/counter.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { idempotency } from '../../middleware/idempotency.middleware.js';
import {
    createCounterSchema,
    updateCounterSchema,
    incrementCounterSchema,
    getCounterSchema,
    deleteCounterSchema,
    joinCounterSchema,
    updateShareSchema,
} from '../schemas/counter.schema.js';

const router = express.Router();

router.use(jwt);
router.use(idempotency);

router.post('/', validate(createCounterSchema), post);
router.get('/', getAllByUser);
router.delete('/:counterId', validate(deleteCounterSchema), remove);
router.put('/update/:counterId', validate(updateCounterSchema), put);

router.put('/increment/:counterId', validate(incrementCounterSchema), increment);
router.post('/join', validate(joinCounterSchema), join);
router.put('/remove-shared/:counterId', validate(updateShareSchema), removeShare);

export default router;
