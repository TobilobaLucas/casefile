# Verification

Verified locally on Windows with Node 24, Java 21, Maven 3.9, and an existing embedded Python runtime. Latest work: 26 October 2026.

| Check | Executed result |
|---|---|
| TypeScript typecheck and Vite production build | Passed |
| `npm test` | 7 rule tests passed |
| `mvn -B -o package` in `backend/` | 7 integration tests passed; executable JAR produced |
| `python -m unittest discover -s generator -v` | 4 tests passed, including unique-solution checks for 500 seeds |
| Solo Chromium browser flows | 5 tests passed: complete solution, connections, visible server errors, mobile layout, and screenshots |
| Live multiplayer Chromium flow | 1 test passed against the actual Python service and packaged Java API |

The Java suite covers room-scoped bearer authorization, hashed tokens, private-solution filtering, idempotency, accusation prerequisites, wrong proof, room capacity, concurrent writes, and authenticated SSE delivery. The case-engine fixture endpoint in these tests enforces the generator's Content-Length contract.

Browser QA uses the production build through Vite preview. This avoids a development dependency-prebundling restriction in this sandbox. Desktop and mobile screenshots were inspected; the mobile test checks page overflow. A regression assertion verifies Escape closes a dossier after an interview removes its focused button.

The real-services multiplayer test used two isolated browser contexts, the Python service on port 18081, the packaged Java service on port 18080, and Vite preview on port 5286. It verified room creation and joining, private-solution filtering, an evidence discovery appearing in the other browser, shared notes, and reconnecting after a refresh. This passed after correcting the Java generator client's length-delimited JSON request and preserving the frontend Host through the local proxy.

Together, the executed suites contain 24 passing tests. The 500-seed generator check is one of the four Python tests; it is not reported as 500 separate test cases.

Docker and the PostgreSQL profile have not been executed in this environment; Docker is unavailable. Java persistence tests and the local service use H2. GitHub Actions is supplied but no hosted CI run is claimed.

Private Sites publication was attempted, but source synchronization could not connect to `git.chatgpt-team.site:443`. No deployed version or working hosted URL is claimed. The existing registration is retained in `.openai/hosting.json` for a later retry. Local source, built frontend, screenshots, and the packaged Java service remain available.
