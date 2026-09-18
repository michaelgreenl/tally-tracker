import dotenv from 'dotenv';
import { createServer } from 'http';
import { validateEnvironment } from './config/environment.js';
import { initSentry } from './monitoring/sentry.js';

dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`,
});
validateEnvironment();
initSentry();

// Load modules that capture secrets or create database clients only after validation.
const [{ default: app }, { startCleanupJob }, { default: initializeIO }] = await Promise.all([
    import('./app.js'),
    import('./db/cron.js'),
    import('./socket/index.js'),
]);
const httpServer = createServer(app);
const io = initializeIO(httpServer);

app.set('io', io);
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);

    startCleanupJob();
});
