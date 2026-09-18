import express from 'express';
import {
    getAllByUser,
    post,
    remove,
    put,
    increment,
    join,
    removeShare,
    share,
} from '../controllers/counter.controller.js';
import { jwt } from '../../middleware/auth.middleware.js';
import { verifiedEmail } from '../../middleware/verified-email.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
    createCounterSchema,
    updateCounterSchema,
    incrementCounterSchema,
    deleteCounterSchema,
    joinCounterSchema,
    updateShareSchema,
    getCounterSchema,
} from '../schemas/counter.schema.js';

const router = express.Router();

router.use(jwt);

router.post('/', validate(createCounterSchema), post);
router.get('/', getAllByUser);
router.delete('/:counterId', validate(deleteCounterSchema), remove);
router.put('/update/:counterId', validate(updateCounterSchema), put);

router.put('/increment/:counterId', validate(incrementCounterSchema), increment);
router.post('/join', verifiedEmail, validate(joinCounterSchema), join);
router.post('/:counterId/share', validate(getCounterSchema), share);
router.put('/remove-shared/:counterId', validate(updateShareSchema), removeShare);

export default router;
