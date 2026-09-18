### Cross-Platform Auth Strategy

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

    App->>Client: apiFetch('/resource')

    Client->>Client: Check Platform.OS

    alt isNative is TRUE (iOS/Android)
        Client->>Storage: Get 'access_token'
        Storage-->>Client: Returns "ey..."
        Client->>Client: Add Header: "Authorization: Bearer ey..."
        Note right of Client: Native apps use explicit headers.
    else isNative is FALSE (Web)
        Client->>Client: Do not add an Authorization header
        Note right of Client: The browser attaches HttpOnly cookies.
    end

    Client->>API: Send request with X-Account-Id for the current account

    activate API
    API->>API: Middleware Check

    alt Header Present?
        API->>API: Validate Access Token
    else Cookie Present?
        API->>API: Validate Access Token Cookie
    end

    alt Token Valid
        API-->>Client: 200 OK
    else Token Expired
        API-->>Client: 401 Unauthorized
        Note right of Client: Triggers refresh flow<br/>See: token-refresh.md
    end
    deactivate API
```

The account header is a consistency check, not an authentication credential.
Changing accounts aborts old requests and stops old queue work. Local writes finish before new-session writes begin.

Web login, refresh, and logout share a Web Lock across tabs. This requires a secure browser context with Web Locks support.
Use HTTPS in production. Localhost also supports this check; plain HTTP on a LAN may not.

Logout requires confirmation and immediately closes the private UI. Queued changes keep their original account owner.
The server increments the account session version, removes its refresh tokens, and disconnects its old sockets.
This ends all account sessions. A failed remote logout does not block local sign-out; the client reports incomplete revocation.
