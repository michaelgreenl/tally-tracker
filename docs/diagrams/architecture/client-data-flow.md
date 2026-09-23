### Client Side Data Flow

Client modules are grouped by the feature that owns them:

- `src/session/`: account state, authentication, credentials, and session write guards.
- `src/billing/`: purchase and restoration operations.
- `src/counters/`: counter state, storage, mutation queue, delivery, and socket updates.
- `src/widgets/`: native widget bridge and durable counter-tap imports.
- `src/api.ts`: shared HTTP transport and token refresh.

Tests stay beside their modules. Import leaf files directly; avoid feature-wide export barrels.

`session/restore-session.ts` checks cached credentials and restores the account without React or routing. `session/session-context.tsx` owns account state, navigation, and account actions. `billing/use-purchase-sync.ts` owns purchase refresh and native listener cleanup. It receives the profile refresh action from session context.

`src/counters/counter-rules.ts` owns pure ordering, guest limits, and snapshot reconciliation. `counter-context.tsx` owns React state, subscriptions, and serialized mutation timing. `CounterService` owns storage access and command creation. `SyncManager` owns queue delivery and retries. Keep session, revision, and pending-write checks with the operations they protect.

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
    }

    namespace Infrastructure {
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
