import dotenv from 'dotenv';
dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`,
});

import app from './app.js';
import { createServer } from 'http';
import { startCleanupJob } from './db/cron.js';
import initializeIO from './socket/index.js';

const httpServer = createServer(app);
const io = initializeIO(httpServer);

app.set('io', io);
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);

    startCleanupJob();
});
