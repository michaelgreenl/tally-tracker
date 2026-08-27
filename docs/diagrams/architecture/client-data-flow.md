### Client Side Data Flow

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
            +restoreSession()
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
