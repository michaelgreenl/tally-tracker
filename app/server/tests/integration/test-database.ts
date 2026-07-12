const REFUSAL_PREFIX = 'Refusing PostgreSQL integration database reset:';
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);
const TEST_DATABASE_PATH = '/tally_tracker_test';

type Environment = Record<string, string | undefined>;

const refuse = (reason: string): never => {
    throw new Error(`${REFUSAL_PREFIX} ${reason}`);
};

const parseDatabaseUrl = (value: string): URL => {
    try {
        return new URL(value);
    } catch {
        return refuse('POSTGRES_URL must be a valid URL.');
    }
};

export const assertIntegrationDatabaseSafety = (env: Environment = process.env): URL => {
    if (env.NODE_ENV !== 'test') {
        refuse('NODE_ENV must be exactly "test".');
    }

    if (env.TALLY_TEST_DB_RESET !== '1') {
        refuse('TALLY_TEST_DB_RESET must be exactly "1".');
    }

    const connectionString = env.POSTGRES_URL;

    if (!connectionString) {
        return refuse('POSTGRES_URL is required.');
    }

    const databaseUrl = parseDatabaseUrl(connectionString);

    if (databaseUrl.search.length > 0 || databaseUrl.hash.length > 0) {
        refuse('POSTGRES_URL must not include query parameters or fragments.');
    }

    if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
        refuse('POSTGRES_URL must use the postgres or postgresql protocol.');
    }

    if (!ALLOWED_HOSTS.has(databaseUrl.hostname)) {
        refuse('POSTGRES_URL host must be localhost or 127.0.0.1.');
    }

    if (databaseUrl.pathname !== TEST_DATABASE_PATH) {
        refuse('POSTGRES_URL database must be exactly tally_tracker_test.');
    }

    return databaseUrl;
};
