### Background Sync Loop

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
    participant Net as Network Monitor
    participant Manager as SyncManager
    participant Queue as SyncQueue (LocalStorage)
    participant Client as API Client (api.ts)
    participant API as Backend API

    Note over Net, API: Scenario: User comes online with pending actions

    Net->>Manager: Event: 'networkStatusChange' (Connected)
    Manager->>Manager: processQueue()
    
    Manager->>Queue: getQueue()
    Queue-->>Manager: Returns [Cmd1, Cmd2]

    loop For Each Command
        Manager->>Client: Execute Command (Cmd1)
        
        Note right of Client: apiFetch handles 401 internally:<br/>attempts refresh + retry before<br/>bubbling the error up.

        Client->>API: Request (with idempotency key)
        
        alt Success (200/201)
            API-->>Client: 200 OK
            Client-->>Manager: Success
            Manager->>Queue: removeCommand(Cmd1)
            Note right of Manager: Permanent success.<br/>Remove from disk.
            
        else Fatal Error (400/422)
            API-->>Client: 400 Bad Request
            Client-->>Manager: ApiError (4xx)
            Manager->>Queue: removeCommand(Cmd1)
            Note right of Manager: Invalid command (bug).<br/>Remove to unblock queue.
            
        else Session Expired (401 after refresh failed)
            API-->>Client: 401 Unauthorized
            Client-->>Manager: ApiError (401)
            Note right of Manager: Session is dead.<br/>Keep commands for after re-auth.
            Manager->>Manager: Trigger logout
            Manager-->>Manager: Stop Processing (Break Loop)

        else Temporary Error (500/Network)
            API-->>Client: 500 Server Error
            Client-->>Manager: ApiError (5xx/0)
            Note right of Manager: Server is down.<br/>Keep in queue for next retry.
            Manager-->>Manager: Stop Processing (Break Loop)
        end
    end
    
    Manager-->>Manager: isSyncing = false
