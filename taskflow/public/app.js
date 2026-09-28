const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem("token"), name = sessionStorage.getItem("name"), filter = "", registering = true;

async function api(path, method = "GET", body) {
  const res = await fetch("/api" + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401 && token && path.startsWith("/tasks")) logout(); // expired or invalid session
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function show() { $("auth").hidden = !!token; $("app").hidden = !token; if (token) { $("who").textContent = name; load(); } }
function logout() { token = null; sessionStorage.clear(); show(); }

$("toggle").onclick = (e) => {
  e.preventDefault(); registering = !registering; $("error").textContent = "";
  $("name").hidden = !registering;
  $("submit").textContent = registering ? "Create account" : "Log in";
  $("toggle").textContent = registering ? "Have an account? Log in" : "New here? Create account";
};
$("submit").onclick = async () => {
  try {
    const d = await api(registering ? "/register" : "/login", "POST", { name: $("name").value, email: $("email").value.trim(), password: $("password").value });
    token = d.token; name = d.name; sessionStorage.setItem("token", token); sessionStorage.setItem("name", name);
    $("password").value = ""; show();
  } catch (e) { $("error").textContent = e.message; }
};
$("logout").onclick = logout;
$("form").onsubmit = async (e) => {
  e.preventDefault();
  try { await api("/tasks", "POST", { title: $("title").value, dueDate: $("due").value || null }); $("title").value = ""; $("due").value = ""; load(); }
  catch (err) { $("msg").textContent = err.message; }
};
document.querySelectorAll("#filters button").forEach((b) => (b.onclick = () => { filter = b.dataset.s; load(); }));

async function load() {
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("active", b.dataset.s === filter));
  try { $("msg").textContent = ""; render(await api("/tasks" + (filter ? "?status=" + filter : ""))); }
  catch (e) { $("msg").textContent = e.message; }
}
function render(tasks) {
  const list = $("list"), today = new Date().toISOString().slice(0, 10);
  list.innerHTML = "";
  tasks.forEach((t) => {
    const li = document.createElement("li"), title = document.createElement("span"), due = document.createElement("small");
    title.textContent = t.title; if (t.status === "done") title.className = "done"; // textContent: no HTML injection
    due.textContent = t.dueDate ? "Due " + t.dueDate : "";
    if (t.dueDate && t.dueDate < today && t.status !== "done") due.className = "overdue";
    const sel = document.createElement("select");
    ["todo", "in-progress", "done"].forEach((s) => sel.add(new Option(s, s, false, s === t.status)));
    sel.onchange = () => api("/tasks/" + t.id, "PUT", { status: sel.value }).then(load).catch((e) => ($("msg").textContent = e.message));
    const del = document.createElement("button"); del.textContent = "Delete"; del.className = "ghost";
    del.onclick = () => api("/tasks/" + t.id, "DELETE").then(load).catch((e) => ($("msg").textContent = e.message));
    li.append(title, due, sel, del); list.appendChild(li);
  });
  $("count").textContent = tasks.length ? tasks.length + " task(s)" : "No tasks here yet.";
}
show();
