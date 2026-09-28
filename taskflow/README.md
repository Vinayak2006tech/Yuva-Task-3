# TaskFlow - Full-Stack Task Manager

A task manager with user accounts. Each user registers, logs in, and manages a private list of tasks with status and due dates.

**Author:** Vinayak Vaishy

## Features
- Register / log in (hashed passwords, signed tokens that expire after 8 hours)
- Create, edit status, filter and delete tasks; overdue tasks are highlighted
- Users can only access their own tasks
- Server-side validation and clear error messages
- 11 automated API tests

## Run it
```bash
npm start        # http://localhost:5000
npm test         # runs the API test suite
```
No `npm install` is needed: the project has no dependencies. Optional environment variables: `PORT`, `JWT_SECRET` (set this in real use), `DATA_FILE`.

## Architecture
```
Browser (public/: HTML, CSS, JS)  --fetch JSON-->  server/server.js (routes + validation)
                                                     |-- server/auth.js  (scrypt hashing, signed tokens)
                                                     '-- server/store.js (JSON file persistence)
```
| Layer | File | Responsibility |
|---|---|---|
| UI | `public/` | Login/register form, task list, filters, calls the API |
| API | `server/server.js` | Routing, validation, authorization, static files |
| Auth | `server/auth.js` | Password hashing and token signing/verification |
| Data | `server/store.js` | Load/save users and tasks |

**Data models:** `User { id, name, email, password (salt:hash) }` and `Task { id, userId, title, status, dueDate }`. Status is `todo`, `in-progress` or `done`.

## API
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | No | Create account, returns token (201) |
| POST | `/api/login` | No | Returns token (200) or 401 |
| GET | `/api/tasks?status=` | Yes | List own tasks, optional status filter |
| POST | `/api/tasks` | Yes | Create task (201) |
| PUT | `/api/tasks/:id` | Yes | Update title, status or dueDate |
| DELETE | `/api/tasks/:id` | Yes | Delete task |

Send the token as `Authorization: Bearer <token>`. Errors return `{ "error": "message" }` with 400, 401, 404, 409 or 500.

## Architecture decisions
- **Dependency-free Node backend:** keeps setup to one command and makes the code easy to read end to end.
- **scrypt + per-user salt for passwords:** built into Node, and deliberately slow to resist brute force.
- **Signed expiring tokens (HMAC-SHA256):** stateless auth with no session storage.
- **Same 404 for missing and other users' tasks:** does not reveal which task ids exist.
- **`textContent` in the UI:** task titles are never inserted as HTML, which prevents script injection.
- **Store as a separate module:** persistence is isolated so it can be replaced.

## Testing
`tests/api.test.js` covers: registration (success, duplicate email, bad email, short password), login (right and wrong password), missing and tampered tokens, task validation (empty, too long, bad date, bad status), filtering, cross-user access (404), invalid JSON, unknown routes, delete, and path traversal on static files.

## Developer guide
- **Add a task field** (e.g. `priority`): add it to `checkTask` and the `POST`/`PUT` handlers in `server.js`, then to `render()` in `public/app.js`, then add a test.
- **Add a route:** add a branch in the handler in `server.js` (after the auth check if it needs login) and a test.
- **Move to MongoDB:** replace `store.js` with Mongoose models (`User`, `Task`) and turn the route handlers into async Mongoose calls. The API contract and the tests stay the same.

## Known limitations
- JSON-file storage suits one server process and small data; use MongoDB for real deployments.
- No rate limiting, password reset or HTTPS handling; put it behind a reverse proxy or a host that provides HTTPS.
