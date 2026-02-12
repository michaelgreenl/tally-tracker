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
    participant App as Vue App
    participant Client as API Client (api.ts)
    participant Storage as Capacitor Prefs
    participant API as Backend

    App->>Client: apiFetch('/resource')
    
    Client->>Client: Check Capacitor.isNativePlatform()
    
    alt isNative is TRUE (iOS/Android)
        Client->>Storage: Get 'access_token'
        Storage-->>Client: Returns "ey..."
        Client->>Client: Add Header: "Authorization: Bearer ey..."
        Note right of Client: Native apps bypass Cookie issues<br/>by using explicit Headers
    else isNative is FALSE (Web)
        Client->>Client: Do NOT add Header
        Note right of Client: Browser automatically attaches<br/>HttpOnly Cookies
    end
    
    Client->>API: Send Request
    
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
