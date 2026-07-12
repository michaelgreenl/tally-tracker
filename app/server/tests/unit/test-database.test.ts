import { describe, expect, it } from 'vitest';
import { assertIntegrationDatabaseSafety } from '../integration/test-database.js';

describe('integration database safety guard', () => {
    it('rejects connection overrides in query parameters', () => {
        expect(() =>
            assertIntegrationDatabaseSafety({
                NODE_ENV: 'test',
                TALLY_TEST_DB_RESET: '1',
                POSTGRES_URL:
                    'postgresql://tally_test_user:tally_test_password@127.0.0.1:5433/tally_tracker_test?host=prod.example.com',
            }),
        ).toThrow(
            'Refusing PostgreSQL integration database reset: POSTGRES_URL must not include query parameters or fragments.',
        );
    });
});
