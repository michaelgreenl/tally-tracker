### Development Web Auth Flow

Expo proxies web development API requests to `EXPO_PUBLIC_API_URL` (default: `http://localhost:3000`).
The target can be the local API or Render. Restart Expo after changing this value.

The browser uses same-origin requests. The proxy removes the upstream cookie domain and `Secure` attribute,
and sets `SameSite=Lax` for local HTTP development. It preserves `HttpOnly`, expiry, and separate cookie headers.
Production API cookie settings do not change.

Socket.IO uses HTTP polling through this proxy during web development. Native and production clients keep their existing transports
and call the configured API directly. This proxy does not exist in the static web export.

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
    actor User
    participant Browser as Expo Web (localhost:8081)
    participant Proxy as Expo development proxy
    participant API as Configured API (local or Render)
    participant DB as Database

    User->>Browser: Click "Login" (remember me ON)

    Browser->>Proxy: POST /users/login (same origin)
    Proxy->>API: Forward request

    activate API
    API->>DB: Find User & Validate Password
    DB-->>API: User Data

    API->>API: Generate access token
    API->>API: Generate refresh token
    API->>DB: Store refresh token record

    API-->>Proxy: 200 OK + Set-Cookie (access + refresh)
    deactivate API

    Note left of Proxy: Local cookies use<br/>Secure: false, SameSite: Lax
    Proxy-->>Browser: Forward response with local cookies
    Browser->>Browser: Both Cookies Saved Successfully
    Browser->>Proxy: GET /counters with access cookie
    Proxy->>API: Forward request and cookie
    API-->>Proxy: Authenticated counter response
    Proxy-->>Browser: Counter response
```
