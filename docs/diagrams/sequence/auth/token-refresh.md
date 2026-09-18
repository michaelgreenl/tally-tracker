### Token Refresh Flow

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
    participant App as Expo App
    participant Client as API Client (api.ts)
    participant Storage as Expo SecureStore
    participant API as Backend
    participant DB as Database

    Note over App, DB: Original request returned 401 (access token expired)

    Client->>Client: Check Platform.OS

    alt isNative is TRUE (iOS/Android)
        Client->>Storage: Get 'refresh_token'
        Storage-->>Client: Returns refresh token
        Client->>API: POST /users/refresh (JSON body: refreshToken)
    else isNative is FALSE (Web)
        Client->>API: POST /users/refresh (Cookie)
    end

    activate API
    API->>DB: Lock the user and re-read the refresh token

    alt Token Valid
        DB-->>API: Token record found, not expired
        API->>API: Generate new access token
        API->>API: Generate new refresh token (rotation)
        API->>DB: Store replacement and mark old token rotated in one transaction
        Note over API, DB: A retry within 30 seconds returns the same active replacement.

        alt isNative
            API-->>Client: 200 { accessToken, refreshToken }
            Client->>Storage: Store both tokens within the current session write queue
        else Web
            API-->>Client: 200 + Set-Cookie (access + refresh)
        end

        Client->>API: Retry only if the original session is still current
        API-->>Client: 200 OK
        Client-->>App: Return response transparently

    else Token Expired or Invalid
        DB-->>API: Not found / expired
        API-->>Client: 401 Unauthorized
        Client-->>App: Trigger logout + redirect to login
    end
    deactivate API
```

Expired tokens cannot refresh a session. A rotated token cannot create a second replacement.
The server keeps rotated records until expiry so logout can still identify and revoke the account.
Temporary server failures preserve the local session and queued changes.
