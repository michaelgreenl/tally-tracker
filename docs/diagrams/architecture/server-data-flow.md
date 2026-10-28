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

flowchart TB
    subgraph API_Layer
        ExpressApp --> Router --> Middleware["Middleware<br/>jwt · validate · verifiedEmail · rate limits"]
    end

    subgraph Controllers
        UserController ~~~ EmailAuthController ~~~ GoogleAuthController ~~~ AppleAuthController ~~~ CounterController ~~~ BillingController ~~~ HealthController
    end

    subgraph Services
        IdempotencyService ~~~ EmailOtpService --> EmailService ~~~ GoogleAuthService ~~~ AppleAuthService ~~~ RevenueCatService
    end

    subgraph Realtime
        SocketIO --> Presence
    end

    subgraph Data_Layer
        UserRepository ~~~ TokenRepository ~~~ EmailOtpRepository ~~~ CounterRepository ~~~ LoginRateLimitStore
    end

    subgraph External
        Resend ~~~ Google ~~~ Apple ~~~ RevenueCat
    end

    subgraph Infrastructure
        CleanupJob --> PrismaClient -- SQL --> PostgresDB
    end

    API_Layer -- "Dispatches requests" --> Controllers
    Controllers -- "Calls services" --> Services
    Controllers -- "Calls data methods" --> Data_Layer
    Controllers -- "Emits events" --> Realtime
    Services -- "Provider APIs" --> External
    Services -- "Calls data methods" --> Data_Layer
    Realtime -- "Finds users and members" --> Data_Layer
    Data_Layer -- "Queries" --> Infrastructure
```

Counter mutations run inside `IdempotencyService` transactions. A retry with the same key replays the stored response.

Google and Apple sign-in finish through `UserController.sendSession()`, the same session path as password login.

The `jwt` middleware loads the session user from `UserRepository`. Login rate limits use `LoginRateLimitStore`, so the limits hold across processes.

`CleanupJob` runs at startup and then once a day. It deletes expired refresh tokens and login limits.
