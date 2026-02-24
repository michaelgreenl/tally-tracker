### Development Auth Flow with Vite Proxy

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
    participant Browser as Browser (http://localhost)
    participant Proxy as Vite Proxy
    participant API as Render Backend
    participant DB as Database

    User->>Browser: Click "Login" (remember me ON)
    
    Note right of Browser: src/api.ts uses relative path ""<br/> -> so request hits localhost
    Browser->>Proxy: POST http://localhost:8100/users/login
    
    Note right of Proxy: vite.config.ts intercepts request<br/>Target: VITE_API_URL
    Proxy->>API: Forward Request (Cross-Site)
    
    activate API
    API->>DB: Find User & Validate Password
    DB-->>API: User Data
    
    API->>API: Generate access token
    API->>API: Generate refresh token
    API->>DB: Store refresh token record

    Note left of API: cookie.config.ts<br/>Secure: true, SameSite: None
    API-->>Proxy: 200 OK + Set-Cookie (access + refresh)
    deactivate API

    Note right of Proxy: vite.config.ts<br/>cookieDomainRewrite: "localhost"
    Proxy-->>Browser: Pass Response + Rewritten Cookies
    
    Note right of Browser: Cookies are Secure<br/>Browser allows "Secure" on localhost
    Browser->>Browser: Both Cookies Saved Successfully
