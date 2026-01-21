import dotenv from 'dotenv';
dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`,
});

import app from './app.js';
import { createServer } from 'http';

const httpServer = createServer(app);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});
