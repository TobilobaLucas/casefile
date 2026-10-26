# Game API

Base URL: `http://localhost:8080/api`. JSON request and response bodies. Vite and the Compose frontend proxy this path.

## Create a room

`POST /rooms` → `201`

```json
{ "name": "Ada", "seed": 41 }
```

`name` is required, 1–24 nonblank characters. `seed` is optional, integer 0–2147483647. Omitting it requests a random reproducible case variant.

```json
{ "token": "opaque-bearer-token", "playerId": "uuid", "state": { "code": "ABCDEF", "version": 1, "status": "investigating" } }
```

The actual state also contains `caseFile`, `players`, `discovered`, `interviewed`, `statements`, `connections`, `notes`, `timeline`, `mistakes`, and timestamps. Preserve the token; only its hash is stored by the server.

## Join

`POST /rooms/{code}/join` → `200`, same session envelope.

```json
{ "name": "Tobi" }
```

Up to eight members. Closed and full rooms return `409`. Codes are case-insensitive; the room code is an invitation, not an account identity.

## Snapshot

`GET /rooms/{code}` → `200`

Requires `Authorization: Bearer <token>`. A token from another room receives `401`. Public state never includes the private solution, constraint facts, request history, or unopened interview statements.

## Apply an action

`POST /rooms/{code}/actions` → `200`, updated public state.

Requires the same Authorization header. `requestId` must contain 8–64 letters, digits, or hyphens. Use a UUID and retain it when retrying the same command. An already processed ID returns the current snapshot without repeating its effect.

| Type | Other fields | Result |
|---|---|---|
| `inspect` | `target`: exhibit ID | Add examined evidence once |
| `interview` | `target`: suspect ID | Reveal the shared interview transcript once |
| `connect` | `target`, `other`: distinct exhibit IDs | Toggle the undirected connection |
| `note` | `note`: 1–500 characters | Add one shared field note |
| `accuse` | `target`: suspect ID; `evidenceIds`: two distinct exhibit IDs | Validate suspect, prerequisites, and proof; solve or consume an attempt |

```json
{
  "requestId": "381af922-cba3-4da9-a27b-b3aa6ab26235",
  "type": "inspect",
  "target": "access-log"
}
```

## Watch a room

`GET /rooms/{code}/events` → `text/event-stream`

Requires an Authorization header. Each `state` event has the public version as its SSE ID and a complete snapshot as JSON data. Ignore snapshots older than the current version. Comment heartbeats arrive every 20 seconds. Refresh the snapshot and reconnect after disconnection; this is snapshot synchronization, not an event replay API.

## Errors

Domain errors use `{ "message": "Human-readable explanation" }`.

| Status | Meaning |
|---|---|
| 400 | Invalid name, action, exhibit, proof, or unmet accusation prerequisite |
| 401 | Missing token or token not scoped to the requested room |
| 404 | Unknown room |
| 409 | Closed/full room, note limit, or action limit |
| 502 | Invalid case-engine response |
| 503 | Case engine unavailable or timed out |

Spring Boot health: `GET /actuator/health`. The private Python service exposes `GET /health` and `POST /v1/cases/generate`; the latter requires `X-Generator-Secret` and must not be called from the browser.
