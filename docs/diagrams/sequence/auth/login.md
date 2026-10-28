### Login and Registration Flow

Login and registration use one client path. Both responses start a new session. Google and Apple sign-in end with the same session response.

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

sequenceDiagram
    autonumber
    participant Store as Session Context
    participant Client as API Client (api.ts)
    participant Storage as AsyncStorage / SecureStore
    participant API as Backend
    participant DB as Database
    participant Counters as Counter Context
    participant Socket as Socket.io
    participant Sync as SyncManager

    alt Login
        Store->>Client: POST /users/login { email, password, rememberMe }
        API->>DB: Find user by normalized email
        DB-->>API: User record
        API->>API: Compare password hash
        Note right of API: Invalid credentials return 401.<br/>The client shows the error.
    else Registration
        Store->>Client: POST /users { email, password, rememberMe }
        API->>DB: Create the user with a password hash
        API->>API: Send a verification code in the background
        Note right of API: A used email returns 422.
    end

    API->>DB: Lock user and recheck password hash and session version
    API->>API: Generate access token
    API->>DB: Create a revocable login session

    alt rememberMe true (always on native)
        Note over API, DB: The client receives the session's refresh secret.
        API-->>Client: 200 or 201 { user, accessToken, refreshToken } + Set-Cookie
        Client-->>Store: Auth response
        Store->>Storage: Store native tokens when present
        Store->>Storage: Cache user profile after token writes finish
    else rememberMe false on web
        API-->>Client: 200 or 201 { user, accessToken } + Set-Cookie(access), clear old refresh cookie
        Client-->>Store: Auth response
        Store->>Storage: Cache user profile
    end

    Store->>Counters: New session user
    Counters->>Client: GET /counters
    Counters->>Counters: Queue any guest counters as CREATE commands
    Counters->>Socket: connectSocket()
    Socket-->>Counters: session-ready after authenticated room admission
    Counters->>Sync: processQueue()
```

Login opens Home, or the pending invite. Registration opens Verify Email. "Skip for now" opens Home without verification.
Home sends an account without a username to the username step. Sharing, joining, and purchases still require a verified email.
