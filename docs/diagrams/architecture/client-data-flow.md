### Client Side Data Flow

Client modules use this structure:

```text
src/
├── app/                   # Expo routes
├── components/
│   ├── auth/
│   ├── counters/
│   ├── settings/
│   └── shared/
├── contexts/              # React providers and account state
├── hooks/                 # Shared React lifecycle hooks
├── services/
│   ├── auth/
│   ├── billing/
│   ├── counters/
│   └── session/
├── infra/
│   ├── http/
│   ├── monitoring/
│   ├── socket/
│   ├── storage/
│   ├── sync/
│   └── widgets/
├── utils/                 # Pure rules
├── theme/                 # Shared colors
├── content/               # Legal documents
└── __tests__/             # Unit tests, grouped by source location
```

Keep route files in `app/` and reusable UI in `components/`. Group components by their use. Put cross-feature UI in `components/shared/`.

Keep platform variants together, such as `token-storage.ts` and `token-storage.native.ts`. Import files directly. Shared API contracts remain in `packages/core`.

Unit tests mirror source groups under `src/__tests__/`. Plugin unit tests use `src/__tests__/plugins/`. Browser tests remain in `tests/e2e/`. Native widget checks remain in `tests/widgets/`.

`services/session/restore-session.ts` checks cached credentials and restores the account without React or routing. `contexts/session-context.tsx` owns account state, navigation, and account actions. `hooks/use-purchase-sync.ts` owns purchase refresh and native listener cleanup. It receives the profile refresh action from session context.

`utils/counter-rules.ts` owns pure ordering, guest limits, and snapshot reconciliation. `contexts/counter-context.tsx` owns React state, subscriptions, and serialized mutation timing. `services/counters/counter.service.ts` owns counter operations and command creation. `infra/storage/counter-storage.ts` owns local counter storage. `infra/sync/sync-manager.ts` owns queue delivery and retries. Keep session, revision, and pending-write checks with the operations they protect.

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#202020',
      'primaryTextColor': '#fff',
      'primaryBorderColor': '#ffffff',
      'lineColor': '#00ff41',
      'secondaryColor': '#006100',
      'tertiaryColor': '#fff',
      'noteBkgColor': '#333',
      'noteTextColor': '#fff',
      'noteBorderColor': '#fff'
    }
  }
}%%

classDiagram
    direction TB

    namespace Screens {
        class HomeScreen
        class JoinScreen
        class LoginScreen
        class RegisterScreen
        class SettingsScreen
    }

    namespace Contexts {
        class CounterContext {
            +state: counters[]
            +createCounter()
            +incrementCounter()
            +joinCounter()
        }
        class SessionContext {
            +state: user
            +refreshUser()
            +login()
            +register()
        }
    }

    namespace Services {
        class CounterService {
            +fetchRemote()
            +create()
            +increment()
        }
        class AuthService {
            +checkAuth()
            +login()
            +register()
        }
    }

    namespace Infra {
        class SyncManager {
            +init()
            +processQueue()
            +executeCommand()
        }
        class SyncQueue {
            +add()
            +get()
            +remove()
        }
        class apiFetch
        class Socket
        class AsyncStorage
        class SecureStore
        class ExpoNetwork
        class ExpoRouter
    }

    %% Relationships
    HomeScreen ..> CounterContext : Calls actions
    HomeScreen ..> SessionContext : Checks session
    JoinScreen ..> CounterContext : Calls joinCounter()

    LoginScreen ..> SessionContext : Calls login()
    RegisterScreen ..> SessionContext : Calls register()
    SettingsScreen ..> SessionContext : Updates account

    CounterContext ..> CounterService : Counter operations
    SessionContext ..> AuthService : Session operations

    CounterService ..> SyncQueue : Queues mutations
    CounterService ..> SyncManager : Triggers Sync
    CounterContext ..> AsyncStorage : Persists counters

    SyncManager ..> SyncQueue : Reads and removes commands
    SyncManager ..> ExpoNetwork : Watches connectivity
    SyncManager ..> apiFetch : Sends requests
    AuthService ..> apiFetch : Sends requests

    Socket ..> CounterContext : Pushes updates
    AuthService ..> AsyncStorage : Caches user
    AuthService ..> SecureStore : Stores native tokens
    ExpoRouter ..> Screens : Routes URLs
```
