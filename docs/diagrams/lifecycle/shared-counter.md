### Shared Counter Lifecycle

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

stateDiagram-v2
    [*] --> Accepted: User clicks "Join Link"
    
    state "Accepted (Active)" as Accepted
    state "Rejected (Hidden)" as Rejected

    Accepted --> Rejected: User clicks "Remove"
    Rejected --> Accepted: User clicks "Join Link" again
    
    Accepted --> [*]: Owner Deletes Counter
    Rejected --> [*]: Owner Deletes Counter

    note right of Accepted
        Visible in Home View.
        Receives Socket Updates.
    end note

    note right of Rejected
        Hidden from Home View.
        History preserved in DB.
    end note
    
    note bottom of [*]
        Prisma Cascade Delete
        removes the Share record.
    end note
```
