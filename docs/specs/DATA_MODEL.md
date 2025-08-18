# AroWā Data Model

This document outlines all data formats and message types in the AroWā application.

---

## Table of Contents

1. [Message Overview](#message-overview)
2. [Message Types](#message-types)
3. [Message Flows](#message-flows)
4. [Data Structures](#data-structures)

---

## 1. Message Overview

All communication between client and server is via JSON WebSocket messages. Every message has a `type` (string) and may have additional fields. All fields are validated and sanitized on both client and server. Unknown fields are ignored unless otherwise specified.

---

## 2. Message Types

### Message Type Table

| Type                | Direction        | Required Fields                 | Optional Fields | Description                       |
| ------------------- | ---------------- | ------------------------------- | --------------- | --------------------------------- |
| `session_join`      | Client -> Server | sessionId, session, timer, user |                 | Join or create session            |
| `session_update`    | Client -> Server | session                         | timer           | Update session intervals/settings |
| `timer_update`      | Client -> Server | timer                           |                 | Update timer state                |
| `user_update`       | Client -> Server | user                            |                 | Update user profile               |
| `user_list`         | Client -> Server |                                 |                 | Request list of connected users   |
| `ping`              | Client -> Server |                                 |                 | Heartbeat ping                    |
| `session_created`   | Server -> Client | sessionId, clientId             |                 | New session created               |
| `session_joined`    | Server -> Client | sessionId, clientId, session    |                 | Joined existing session           |
| `session_updated`   | Server -> Client | sessionId, session              |                 | Session updated                   |
| `timer_updated`     | Server -> Client | sessionId, timer                |                 | Timer state updated               |
| `user_connected`    | Server -> Client | sessionId, user                 |                 | User connected                    |
| `user_disconnected` | Server -> Client | sessionId, user                 |                 | User disconnected                 |
| `user_updated`      | Server -> Client | sessionId, user                 |                 | User profile updated              |
| `users_connected`   | Server -> Client | sessionId, users                |                 | List of users                     |
| `pong`              | Server -> Client |                                 |                 | Heartbeat pong                    |
| `error`             | Server -> Client | message                         |                 | Error message                     |

---

### Message JSON Examples

#### Client -> Server

**session_join**

```json
{
  "type": "session_join",
  "sessionId": "focus-abc123",
  "session": {
    "name": "Morning Focus",
    "description": "Daily focus session",
    "intervals": {
      "lastUpdated": 1692300000000,
      "items": [
        { "name": "Focus", "duration": 1500, "alert": "Default", "customCSS": "" },
        { "name": "Break", "duration": 300, "alert": "Gentle", "customCSS": "" }
      ]
    }
  },
  "timer": {
    "repeat": false,
    "interval": 0,
    "remaining": 1500000,
    "isRunning": true,
    "isPaused": false
  },
  "user": {
    "clientId": "38bd6bc8-0a2a-4e7c-986e-8b98fcdd7fc6",
    "name": "Alice",
    "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg"
  }
}
```

**session_update**

```json
{
  "type": "session_update",
  "session": {
    "name": "Morning Focus",
    "description": "Updated description",
    "intervals": {
      "lastUpdated": 1692300000001,
      "items": [
        { "name": "Focus", "duration": 1500, "alert": "Default", "customCSS": "" },
        { "name": "Break", "duration": 300, "alert": "Gentle", "customCSS": "" }
      ]
    }
  },
  "timer": {
    "repeat": false,
    "interval": 1,
    "remaining": 1200000,
    "isRunning": false,
    "isPaused": true
  }
}
```

**timer_update**

```json
{
  "type": "timer_update",
  "timer": {
    "repeat": false,
    "interval": 1,
    "remaining": 1200000,
    "isRunning": false,
    "isPaused": true
  }
}
```

**user_update**

```json
{
  "type": "user_update",
  "user": {
    "clientId": "38bd6bc8-0a2a-4e7c-986e-8b98fcdd7fc6",
    "name": "Alice",
    "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg"
  }
}
```

**user_list**

```json
{
  "type": "user_list"
}
```

**ping**

```json
{
  "type": "ping"
}
```

#### Server -> Client

**session_created**

```json
{
  "type": "session_created",
  "sessionId": "focus-abc123",
  "clientId": "38bd6bc8-0a2a-4e7c-986e-8b98fcdd7fc6"
}
```

**session_joined**

```json
{
  "type": "session_joined",
  "sessionId": "focus-abc123",
  "clientId": "38bd6bc8-0a2a-4e7c-986e-8b98fcdd7fc6",
  "session": {
    "sessionId": "focus-abc123",
    "name": "Morning Focus",
    "description": "Daily focus session",
    "intervals": {
      "lastUpdated": 1692300000000,
      "items": [
        { "name": "Focus", "duration": 1500, "alert": "Default", "customCSS": "" },
        { "name": "Break", "duration": 300, "alert": "Gentle", "customCSS": "" }
      ]
    },
    "timer": {
      "repeat": false,
      "interval": 0,
      "remaining": 1500000,
      "isRunning": true,
      "isPaused": false
    },
    "users": {
      "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d": {
        "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
        "name": "Alice",
        "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg",
        "isOnline": true
      }
    }
  }
}
```

**session_updated**

```json
{
  "type": "session_updated",
  "sessionId": "focus-abc123",
  "session": {
    "name": "Morning Focus",
    "description": "Updated description",
    "intervals": {
      "lastUpdated": 1692300000001,
      "items": [
        { "name": "Focus", "duration": 1500, "alert": "Default", "customCSS": "" },
        { "name": "Break", "duration": 300, "alert": "Gentle", "customCSS": "" }
      ]
    }
  }
}
```

**timer_updated**

```json
{
  "type": "timer_updated",
  "sessionId": "focus-abc123",
  "timer": {
    "repeat": false,
    "interval": 1,
    "remaining": 1200000,
    "isRunning": false,
    "isPaused": true
  }
}
```

**user_connected**

```json
{
  "type": "user_connected",
  "sessionId": "focus-abc123",
  "user": {
    "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
    "name": "Alice",
    "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg",
    "isOnline": true
  }
}
```

**user_disconnected**

```json
{
  "type": "user_disconnected",
  "sessionId": "focus-abc123",
  "user": {
    "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
    "name": "Alice",
    "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg",
    "isOnline": false
  }
}
```

**user_updated**

```json
{
  "type": "user_updated",
  "sessionId": "focus-abc123",
  "user": {
    "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
    "name": "Alice",
    "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg",
    "isOnline": true
  }
}
```

**users_connected**

```json
{
  "type": "users_connected",
  "sessionId": "focus-abc123",
  "users": {
    "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d": {
      "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
      "name": "Alice",
      "avatarUrl": "https://www.gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=80&d=identicon&r=pg",
      "isOnline": true
    },
    "0b81275a24b5fa40bfb457ed00e27dab4a991466f6f6a74414523f7706c5969a": {
      "hashedId": "bedd6c3636f3aa37a3aa94019830580ce59b2564164c6d7cb10938a32f47a57d",
      "name": "Bob",
      "avatarUrl": "https://www.gravatar.com/avatar/656b96e9adddd2acb5f709afa3545b762384ffd3a301c9dd15ca50800409a695?s=80&d=identicon&r=pg",
      "isOnline": false
    }
  }
}
```

**pong**

```json
{
  "type": "pong"
}
```

**error**

```json
{
  "type": "error",
  "message": "Invalid session ID format"
}
```

---

## 3. Message Flows

### Session Creation

1. Client sends `session_join` when the user joins a session.
2. Server replies with `session_created` (if new) or `session_joined` (if existing).
3. Server broadcasts `user_connected` with user information to other clients.

### Settings/Interval Update

1. Client sends `session_update` to set settings/intervals.
2. Server broadcasts `session_updated` to other clients.

### Timer Control

1. Client sends `timer_update` when the timer state changes.
2. Server updates timer and broadcasts `timer_updated` to other clients.

### User Profile Update

1. Client sends `user_update` on profile changes.
2. Server broadcasts `user_updated` to other clients.

### User List Request

1. Client sends `user_list` when the user wants to see the list of connected users.
2. Server replies with `users_connected` (map of clientId -> User).

### User Disconnect

1. Client sends `websocketDisconnected` when the user closes the page or times out.
2. Server broadcasts `user_disconnected` with user information to other clients.

### Heartbeat

1. Client sends `ping`.
2. Server replies with `pong`.

### Error Handling

1. Server sends `error` message with `message` field on any invalid input or failure.

---

## 4. Data Structures

### User Object (Client)

| Field     | Type   | Default | Constraints/Notes                  |
| --------- | ------ | ------- | ---------------------------------- |
| hashedId  | string |         | SHA256 hash of the user's clientId |
| clientId  | string |         | UUID v4, `/^[a-f0-9-]{36}$/`       |
| name      | string | ""      | Max 50 chars                       |
| email     | string | ""      | Used to generate Gravatar URL      |
| avatarUrl | string | ""      | Max 500 chars, Gravatar URL        |

### User Object (List)

| Field     | Type    | Default | Constraints/Notes                  |
| --------- | ------- | ------- | ---------------------------------- |
| hashedId  | string  |         | SHA256 hash of the user's clientId |
| name      | string  | ""      | Max 50 chars                       |
| avatarUrl | string  | ""      | Max 500 chars, Gravatar URL        |
| isOnline  | boolean | true    | Server-managed                     |

### Timer State Object (Internal)

| Field           | Type    | Default | Constraints/Notes            |
| --------------- | ------- | ------- | ---------------------------- |
| startedInterval | number  | 0       | Index of starting interval   |
| startedAt       | number  | 0       | ms timestamp when started    |
| pausedAt        | number  | 0       | ms timestamp when pasued     |
| timePaused      | number  | 0       | Total time in ms paused      |
| repeat          | boolean | false   |                              |
| interval        | number  | 0       | Index of current interval    |
| remaining       | number  | 1500000 | ms, clamped to [0, 86400000] |
| isRunning       | boolean | false   |                              |
| isPaused        | boolean | false   |                              |

### Timer State Object (Transient)

The transient timer state object does not include `started*`, `pausedAt` or `timePaused` values. The receiver (client or server) calculates the timer state based on its internal clock.

| Field     | Type    | Default | Constraints/Notes            |
| --------- | ------- | ------- | ---------------------------- |
| repeat    | boolean | false   |                              |
| interval  | number  | 0       | Index of current interval    |
| remaining | number  | 1500000 | ms, clamped to [0, 86400000] |
| isRunning | boolean | false   |                              |
| isPaused  | boolean | false   |                              |

### Interval Object

| Field     | Type   | Default   | Constraints/Notes              |
| --------- | ------ | --------- | ------------------------------ |
| name      | string | "Focus"   | Max 50 chars                   |
| duration  | number | 1500      | seconds, clamped to [1, 86400] |
| alert     | string | "Default" | Max 50 chars                   |
| customCSS | string | ""        |                                |

### Intervals Container

| Field       | Type   | Default | Constraints/Notes         |
| ----------- | ------ | ------- | ------------------------- |
| lastUpdated | number |         | ms timestamp when updated |
| items       | array  | []      | Array of Intervals        |

### Session Object

| Field       | Type   | Default | Constraints/Notes    |
| ----------- | ------ | ------- | -------------------- |
| sessionId   | string |         | [a-z0-9-]{3,64}      |
| name        | string | ""      | Max 1000 chars       |
| description | string | ""      | Max 1000 chars       |
| intervals   | object |         | Intervals Container  |
| timer       | object |         | Timer State Object   |
| users       | object |         | Map hashedId -> User |
| user        | object |         | User Object (Client) |
