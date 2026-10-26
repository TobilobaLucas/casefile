# Architecture notes

CASEFILE has two execution paths: a static solo demo and an authoritative multiplayer stack. The separation makes the interface easy to try without pretending the browser can protect a secret answer.

## Ownership

Python owns case construction. Its private endpoint returns narrative records plus the solution and machine-readable facts used for consistency checks. Java strips `solution`, `facts`, and unopened interview statements before creating public room state. Statements become public when the team requests an interview. On closure, the explanation and culprit are intentionally revealed.

Java owns game transitions. The browser can request an inspection, interview, connection, note, or accusation. It cannot set discovered evidence, score, status, members, or the result directly.

## Durable state and concurrent writes

Flyway creates two tables. `game_room` stores public state and private solution as separate JSON text columns; `room_member` stores display names and SHA-256 hashes of randomly generated, high-entropy bearer tokens. JSON snapshots keep this small game easy to evolve. They are a tradeoff: reporting across thousands of rooms would benefit from normalized events and projections.

Each mutation loads its room with `PESSIMISTIC_WRITE`. Joining uses the same lock, making the eight-player admission check atomic. A request's ID is recorded in the same transaction as its changes; replaying that ID returns the latest state without applying it again. Domain events, changed state, and the monotonically increasing public version commit together. JPA's `@Version` adds a second database-level guard.

The room allows 1,000 distinct actions, 50 notes of up to 500 characters, four interviews, six exhibits, and three failed theories. A closed room rejects new mutations. Idempotent retries of previously committed commands remain readable after closure.

## Event delivery and recovery

The API pushes full public snapshots through authenticated SSE. `fetch` streams let the client attach its bearer token in an Authorization header instead of exposing it in a query string. A heartbeat keeps idle connections alive; streams expire after five minutes and reconnect.

Publishing happens after transaction commit. The client compares versions because independent callbacks can arrive out of order. Subscribe is followed by a fresh snapshot to close the gap between the initial read and listener registration. A broken stream triggers a snapshot refresh and exponential reconnect delay capped at ten seconds.

The SSE hub is in memory. This version deliberately targets **one API instance**. PostgreSQL locks coordinate durable mutations across processes, but they do not fan events out to subscribers in another process. Multi-instance deployment needs Redis pub/sub or a durable event/outbox pipeline, or a periodic polling fallback. The app does not claim that scaling the replica count alone provides correct live updates.

## Case construction

The Python engine uses a local seeded random generator and isolated copies of character templates. It creates one authored plot with four possible culprit variants. It embeds one badge in the access log and one assigned locker in the physical-custody receipt. The solver intersects the matching suspect sets and requires exactly the selected culprit. Natural-language records follow these facts.

This checks the authored model, not arbitrary natural-language truth. The tests cover 500 seeds, ensure all four suspects appear, check deterministic reconstruction, and deliberately corrupt a constraint to verify rejection. Seed 41 is the introductory fixture; its wording may be lightly edited while preserving the same evidence and answer contract.

## Deployment boundaries

- Docker Compose puts the Python engine and database on its internal network. Only the frontend is published, on loopback port 8088. Nginx forwards `/api` and disables buffering for SSE.
- The Python adapter requires the shared `X-Generator-Secret`. Its response includes the answer, so it must never be treated as a public game API.
- The solo answer is present in the shipped fixture. This mode is for exploration and is unsuitable for competitive scoring.
- Live bearer tokens are stored in session storage. This supports reloads in the same tab, not account recovery. A copied token grants that member's access.
- Room creation and joining currently lack public-service abuse controls. Add rate limits, room TTLs, admission policy, and TLS before exposing multiplayer to the internet.
- CORS allows explicit local origins by default. For separately hosted frontends, configure exact origins. No browser integration with university credentials is involved.
- H2 is a convenient persistent local default. Compose uses PostgreSQL 17. Run the Java tests against real PostgreSQL before relying on its behavior in production; local integration tests use H2.

## Failure behavior

If Python cannot generate a case within its timeout, Java returns a 503 with an actionable message. It does not silently substitute a fabricated room. Existing rooms do not depend on Python after creation.

If a team request fails, the UI keeps the existing state and reports the error. It does not silently move the team to the solo demo. Server deduplication supports retries with the same request ID; the current UI reports failed requests and leaves retry decisions to the user.
