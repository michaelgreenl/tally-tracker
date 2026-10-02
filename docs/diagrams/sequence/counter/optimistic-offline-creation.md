### Offline/Optimistic Counter Creation

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
    participant View as Home Screen
    participant Store as Counter Context
    participant Queue as SyncQueue (AsyncStorage)
    participant Svc as CounterService
    participant Manager as SyncManager
    participant API as Backend

    User->>View: Click "Create Counter"
    View->>Store: createCounter({title: "My Title"})

    Note right of Store: 1. OPTIMISTIC UPDATE
    Store->>Store: Generate UUID (crypto.randomUUID)
    Store->>Store: Push to local array
    Store->>Store: saveState() (Persist to Disk)

    Store-->>View: Return Success (Instant)
    View-->>User: Show new counter in list

    Note right of Store: 2. BACKGROUND WORK

    alt Authenticated user (!isGuest)
        Store->>Svc: Service.create(counter)
        Svc->>Queue: Add "CREATE" Command
        Queue-->>Svc: Command Queued
        Svc->>Manager: processQueue()

        par Background Sync
            Manager->>Queue: get()
            Queue-->>Manager: Pending Commands
            Manager->>API: POST /counters (Payload + Idempotency Key)
            API-->>Manager: 201 Created or replayed response
            Manager->>Queue: remove(Command.id)
        end
    else Guest user
        Store-->>Store: Skip CounterService.create()
        Note right of Store: Guest counters stay local<br/>and do not enter SyncQueue.
    end
```

New counters are personal. Starting sharing is a separate online action after pending writes finish.
The server creates the invite after checking ownership, email verification, and Premium access.
