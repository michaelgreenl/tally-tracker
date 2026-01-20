import express from 'express';
import { getById, getAllByUser, post, remove, put, increment } from '../controllers/counter.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
    createCounterSchema,
    updateCounterSchema,
    incrementCounterSchema,
    getCounterSchema,
    deleteCounterSchema,
} from '../schemas/counter.schema.js';

const router = express.Router();

router.use(jwt);

router.post('/', validate(createCounterSchema), post);
router.get('/', getAllByUser);

router.delete('/:counterId', validate(deleteCounterSchema), remove);
router.get('/:counterId', validate(getCounterSchema), getById);
router.put('/update/:counterId', validate(updateCounterSchema), put);
router.put('/increment/:counterId', validate(incrementCounterSchema), increment);

export default router;
