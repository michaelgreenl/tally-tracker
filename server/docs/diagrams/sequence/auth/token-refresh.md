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
    participant App as Vue App
    participant Client as API Client (api.ts)
    participant Storage as Capacitor Prefs
    participant API as Backend
    participant DB as Database

    Note over App, DB: Original request returned 401 (access token expired)

    Client->>Client: Check Capacitor.isNativePlatform()

    alt isNative is TRUE (iOS/Android)
        Client->>Storage: Get 'refresh_token'
        Storage-->>Client: Returns refresh token
        Client->>API: POST /users/refresh (Bearer header)
    else isNative is FALSE (Web)
        Client->>API: POST /users/refresh (Cookie)
    end

    activate API
    API->>DB: Lookup refresh token
    
    alt Token Valid
        DB-->>API: Token record found, not expired
        API->>API: Generate new access token
        API->>API: Generate new refresh token (rotation)
        API->>DB: Invalidate old refresh token
        API->>DB: Store new refresh token

        alt isNative
            API-->>Client: 200 { accessToken, refreshToken }
            Client->>Storage: Store both tokens
        else Web
            API-->>Client: 200 + Set-Cookie (access + refresh)
        end

        Client->>API: Retry original request with new access token
        API-->>Client: 200 OK
        Client-->>App: Return response transparently

    else Token Expired or Invalid
        DB-->>API: Not found / expired
        API-->>Client: 401 Unauthorized
        Client-->>App: Trigger logout + redirect to login
    end
    deactivate API
