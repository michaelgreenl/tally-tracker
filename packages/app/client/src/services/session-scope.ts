export class SessionChangedError extends Error {
    constructor() {
        super('The account changed. Please try again.');
        this.name = 'SessionChangedError';
    }
}

export type SessionScope = { id: number; signal: AbortSignal; userId: string | null };

let controller = new AbortController();
let current: SessionScope = { id: 0, signal: controller.signal, userId: null };
let writes = Promise.resolve();

export const getSessionScope = () => current;

export function changeSession(userId: string | null = null): SessionScope {
    controller.abort();
    controller = new AbortController();
    current = { id: current.id + 1, signal: controller.signal, userId };
    return current;
}

export function assertSession(scope: SessionScope) {
    if (scope !== current || scope.signal.aborted) throw new SessionChangedError();
}

// Serialize credential/cache writes so an old write cannot finish after a new login's write.
// A null scope is reserved for account-targeted deletion, which must survive a new login.
export function writeSession<T>(scope: SessionScope | null, write: () => Promise<T>): Promise<T> {
    const result = writes.then(() => {
        if (scope) assertSession(scope);
        return write();
    });
    writes = result.then(
        () => undefined,
        () => undefined,
    );
    return result.then((value) => {
        if (scope) assertSession(scope);
        return value;
    });
}
