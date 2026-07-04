### Server Side Data Flow

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

    namespace API_Layer {
        class ExpressApp
        class Router
        class Middleware {
            +auth (JWT)
            +validate (Zod)
        }
    }

    namespace Logic_Layer {
        class CounterController
        class UserController
        class IdempotencyService {
            +runIdempotentMutation()
        }
    }

    namespace Data_Layer {
        class CounterRepository
        class UserRepository
        class TokenRepository
    }

    namespace Infrastructure {
        class PrismaClient
        class SocketIO
        class PostgresDB
    }

    %% Flow
    ExpressApp --> Router : Mounts
    Router --> Middleware : Uses
    Router --> CounterController : Dispatches Request
    Router --> UserController : Dispatches Request

    CounterController ..> IdempotencyService : Wraps Mutations
    CounterController ..> CounterRepository : Calls Data Methods
    UserController ..> UserRepository : Calls Data Methods
    UserController ..> TokenRepository : Manages Refresh Tokens

    CounterController ..> SocketIO : Emits Events

    IdempotencyService ..> PrismaClient : Inserts/Replays Logs
    CounterRepository ..> PrismaClient : Queries
    UserRepository ..> PrismaClient : Queries
    TokenRepository ..> PrismaClient : Queries

    PrismaClient ..> PostgresDB : SQL
```
