import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address.');
