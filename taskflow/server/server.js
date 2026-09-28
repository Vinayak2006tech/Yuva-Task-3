// HTTP server: REST API under /api, static front end from /public.
const http = require("http"), fs = require("fs"), path = require("path");
const auth = require("./auth"), createStore = require("./store");

const STATUSES = ["todo", "in-progress", "done"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function checkTask(b, partial) {
  if ((!partial || b.title !== undefined) && (typeof b.title !== "string" || !b.title.trim() || b.title.length > 100))
    return "Title is required (max 100 characters)";
  if (b.status !== undefined && !STATUSES.includes(b.status)) return "Status must be one of: " + STATUSES.join(", ");
  if (b.dueDate != null && !DATE.test(b.dueDate)) return "dueDate must be YYYY-MM-DD";
  return null;
}

function createServer(dataFile) {
  const store = createStore(dataFile), db = store.db;
  const send = (res, code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  const readBody = (req) => new Promise((ok, fail) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1e5) { req.destroy(); fail(new Error("Body too large")); } });
    req.on("end", () => {
      try {
        const v = raw ? JSON.parse(raw) : {};
        if (typeof v !== "object" || v === null || Array.isArray(v)) throw 0;
        ok(v);
      } catch { fail(new Error("Invalid JSON body")); }
    });
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost"), p = url.pathname, m = req.method;

    if (!p.startsWith("/api/")) { // static files, with path-traversal protection
      const file = path.join(PUBLIC, p === "/" ? "index.html" : p);
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end("Not found");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
      return fs.createReadStream(file).pipe(res);
    }

    let body;
    try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

    try {
      if (p === "/api/register" && m === "POST") {
        const { name, email, password } = body;
        if (typeof name !== "string" || !name.trim() || !/^\S+@\S+\.\S+$/.test(String(email))) return send(res, 400, { error: "Valid name and email are required" });
        if (typeof password !== "string" || password.length < 6) return send(res, 400, { error: "Password must be at least 6 characters" });
        if (db.users.some((u) => u.email === email.toLowerCase())) return send(res, 409, { error: "Email already registered" });
        const user = { id: store.id(), name: name.trim(), email: email.toLowerCase(), password: auth.hash(password) };
        db.users.push(user); store.save();
        return send(res, 201, { token: auth.sign({ id: user.id }), name: user.name });
      }
      if (p === "/api/login" && m === "POST") {
        const u = db.users.find((x) => x.email === String(body.email || "").toLowerCase());
        if (!u || !auth.verify(String(body.password || ""), u.password)) return send(res, 401, { error: "Invalid email or password" });
        return send(res, 200, { token: auth.sign({ id: u.id }), name: u.name });
      }

      const route = p.match(/^\/api\/tasks(?:\/(\d+))?$/);
      if (!route) return send(res, 404, { error: "Not found" });
      const me = auth.check((req.headers.authorization || "").replace("Bearer ", ""));
      if (!me) return send(res, 401, { error: "Login required" });
      const id = route[1] && Number(route[1]);
      const mine = db.tasks.filter((t) => t.userId === me.id); // users only ever see their own tasks

      if (m === "GET" && !id) {
        const s = url.searchParams.get("status");
        return send(res, 200, s ? mine.filter((t) => t.status === s) : mine);
      }
      if (m === "POST" && !id) {
        const err = checkTask(body, false);
        if (err) return send(res, 400, { error: err });
        const t = { id: store.id(), userId: me.id, title: body.title.trim(), status: body.status || "todo", dueDate: body.dueDate || null };
        db.tasks.push(t); store.save();
        return send(res, 201, t);
      }
      const task = mine.find((t) => t.id === id);
      if (!task) return send(res, 404, { error: "Task not found" }); // same answer for missing and other users' tasks
      if (m === "PUT") {
        const err = checkTask(body, true);
        if (err) return send(res, 400, { error: err });
        for (const k of ["title", "status", "dueDate"]) if (body[k] !== undefined) task[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
        store.save(); return send(res, 200, task);
      }
      if (m === "DELETE") { db.tasks = db.tasks.filter((t) => t !== task); store.db.tasks = db.tasks; store.save(); return send(res, 200, { deleted: id }); }
      send(res, 405, { error: "Method not allowed" });
    } catch (e) { console.error(e); send(res, 500, { error: "Server error" }); }
  });
}

module.exports = { createServer };
if (require.main === module) {
  const port = process.env.PORT || 5000;
  createServer(process.env.DATA_FILE || path.join(__dirname, "data.json")).listen(port, () => console.log(`TaskFlow running at http://localhost:${port}`));
}
