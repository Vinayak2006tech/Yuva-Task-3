const test = require("node:test"), assert = require("node:assert");
const os = require("os"), path = require("path"), fs = require("fs");
const { createServer } = require("../server/server");

let server, base, a, b; // a and b are two different users' tokens
test.before(async () => {
  server = createServer(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tf-")), "data.json"));
  await new Promise((r) => server.listen(0, r));
  base = "http://localhost:" + server.address().port + "/api";
});
test.after(() => { server.closeAllConnections(); server.close(); });

const call = async (p, method = "GET", body, token) => {
  const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};

test("register: success returns token", async () => {
  const r = await call("/register", "POST", { name: "Asha", email: "asha@test.com", password: "secret1" });
  assert.equal(r.status, 201); a = r.data.token; assert.ok(a);
  b = (await call("/register", "POST", { name: "Ravi", email: "ravi@test.com", password: "secret2" })).data.token;
});
test("register: duplicate email is rejected (409)", async () => {
  assert.equal((await call("/register", "POST", { name: "X", email: "ASHA@test.com", password: "secret1" })).status, 409);
});
test("register: invalid email and short password (400)", async () => {
  assert.equal((await call("/register", "POST", { name: "X", email: "nope", password: "secret1" })).status, 400);
  assert.equal((await call("/register", "POST", { name: "X", email: "x@test.com", password: "123" })).status, 400);
});
test("login: wrong password (401) and correct password (200)", async () => {
  assert.equal((await call("/login", "POST", { email: "asha@test.com", password: "wrong" })).status, 401);
  assert.equal((await call("/login", "POST", { email: "asha@test.com", password: "secret1" })).status, 200);
});
test("tasks: no token or tampered token (401)", async () => {
  assert.equal((await call("/tasks")).status, 401);
  assert.equal((await call("/tasks", "GET", undefined, a.slice(0, -3) + "abc")).status, 401);
});
test("tasks: create, validate, list", async () => {
  const ok = await call("/tasks", "POST", { title: "Write report", dueDate: "2026-10-01" }, a);
  assert.equal(ok.status, 201); assert.equal(ok.data.status, "todo");
  assert.equal((await call("/tasks", "POST", { title: "   " }, a)).status, 400);
  assert.equal((await call("/tasks", "POST", { title: "x".repeat(101) }, a)).status, 400);
  assert.equal((await call("/tasks", "POST", { title: "t", dueDate: "tomorrow" }, a)).status, 400);
  assert.equal((await call("/tasks", "GET", undefined, a)).data.length, 1);
});
test("tasks: update status, reject invalid status, filter", async () => {
  const id = (await call("/tasks", "GET", undefined, a)).data[0].id;
  assert.equal((await call("/tasks/" + id, "PUT", { status: "done" }, a)).data.status, "done");
  assert.equal((await call("/tasks/" + id, "PUT", { status: "finished" }, a)).status, 400);
  assert.equal((await call("/tasks?status=done", "GET", undefined, a)).data.length, 1);
  assert.equal((await call("/tasks?status=todo", "GET", undefined, a)).data.length, 0);
});
test("security: users cannot see, edit or delete each other's tasks", async () => {
  const id = (await call("/tasks", "GET", undefined, a)).data[0].id;
  assert.equal((await call("/tasks", "GET", undefined, b)).data.length, 0);
  assert.equal((await call("/tasks/" + id, "PUT", { status: "todo" }, b)).status, 404);
  assert.equal((await call("/tasks/" + id, "DELETE", undefined, b)).status, 404);
});
test("edge cases: invalid JSON (400), unknown route (404), missing task (404)", async () => {
  assert.equal((await call("/tasks", "POST", "{bad json", a)).status, 400);
  assert.equal((await call("/nothing")).status, 404);
  assert.equal((await call("/tasks/9999", "GET", undefined, a)).status, 404);
});
test("tasks: delete works and task is gone", async () => {
  const id = (await call("/tasks", "GET", undefined, a)).data[0].id;
  assert.equal((await call("/tasks/" + id, "DELETE", undefined, a)).status, 200);
  assert.equal((await call("/tasks", "GET", undefined, a)).data.length, 0);
});
test("static: path traversal is blocked", async () => {
  const r = await fetch(base.replace("/api", "") + "/..%2fserver%2fauth.js");
  assert.equal(r.status, 404);
});
