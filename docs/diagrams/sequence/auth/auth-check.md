```markdown
### Check Auth (Cold Start)

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
    participant App as Vue App (Router Guard)
    participant Store as Auth Store
    participant Storage as Capacitor Prefs
    participant Client as API Client (api.ts)
    participant API as Backend

    Note over App, API: App opened / page refreshed. AUTHORIZED flag exists in localStorage.

    App->>Store: initializeAuth()
    
    Store->>Storage: Get cached user profile
    Storage-->>Store: Cached user (instant UI hydration)

    Store->>Client: GET /users/check-auth

    activate API
    Client->>API: Request (access token via cookie or header)
    API->>API: Validate access token
    
    alt Access Token Valid
        API-->>Client: 200 { user }
        Client-->>Store: User data
        Store->>Storage: Update cached profile
    
    else Access Token Expired
        API-->>Client: 401
        
        Note over Client, API: apiFetch triggers refresh flow<br/>See: token-refresh.md
        Client->>API: POST /users/refresh
        
        alt Refresh Succeeds
            API-->>Client: 200 (new tokens)
            Client->>API: Retry GET /users/check-auth
            API-->>Client: 200 { user }
            Client-->>Store: User data
            Store->>Storage: Update cached profile
        
        else Refresh Fails (expired / invalid)
            API-->>Client: 401
            Client-->>Store: Auth failed
            Store->>Store: logout(false)
            Store->>App: Redirect to /login
        end

    else Network Error
        Client-->>Store: Error
        Note right of Store: Trust cached profile<br/>so app works offline
    end
    deactivate API
