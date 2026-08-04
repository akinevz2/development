#!/usr/bin/env node
// system/drop.mjs — keyboard-driven file dropper for the development devcontainer.
//
// Runs a tiny HTTP server inside the container. VS Code auto-forwards the port
// to the Windows host, so you can open the printed URL in any browser and
// drag-and-drop files from the Windows filesystem onto the page. Files are
// streamed into the chosen destination directory inside the container.
//
// Usage:
//   node system/drop.mjs                # default destination = cwd
//   node system/drop.mjs --out /some/dir
//   node system/drop.mjs --port 7331 --out /some/dir
//
// Keyboard controls on the page:
//   /        focus the directory filter
//   j / k    move selection down / up
//   Enter    confirm destination
//   Esc      clear filter / cancel
//   Tab      move between filter, tree, dropzone, log

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
let port = 7331;
let outDir = process.cwd();
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) port = parseInt(args[i + 1], 10);
    else if (args[i] === "--out" && args[i + 1]) outDir = args[i + 1];
    else if (args[i] === "-h" || args[i] === "--help") {
        console.log(`Usage: node system/drop.mjs [--port N] [--out DIR]

  --port N   HTTP port (default 7331, auto-forwarded by VS Code)
  --out DIR  default destination directory (default: cwd)`);
        process.exit(0);
    }
}

const ROOT = outDir;

// ---------------------------------------------------------------------------
// directory listing
// ---------------------------------------------------------------------------
function listDirs(root) {
    const out = [];
    const walk = (dir, depth) => {
        if (depth > 3) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (e.name.startsWith(".") || e.name === "node_modules") continue;
            const full = path.join(dir, e.name);
            out.push(full);
            walk(full, depth + 1);
        }
    };
    walk(root, 0);
    return [root, ...out].sort();
}

let dirs = listDirs(ROOT);

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/") return page(res);
    if (req.method === "GET" && url.pathname === "/dirs") return json(res, dirs);
    if (req.method === "POST" && url.pathname === "/upload") return upload(req, res, url);
    if (req.method === "POST" && url.pathname === "/shutdown") return shutdown(res);
    res.writeHead(404);
    res.end("not found");
});

server.listen(port, "0.0.0.0", () => {
    console.log(`\n  drop server listening on http://localhost:${port}`);
    console.log(`  destination root: ${ROOT}`);
    console.log(`  open the URL in your browser and drag files onto the canvas.\n`);
});

// ---------------------------------------------------------------------------
// GET / — the page
// ---------------------------------------------------------------------------
function page(res) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
}

// ---------------------------------------------------------------------------
// GET /dirs — directory list as JSON
// ---------------------------------------------------------------------------
function json(res, data) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// POST /upload?to=<abs>&name=<filename>
// Body is the raw file bytes. We stream to <to>/<name>.
// ---------------------------------------------------------------------------
function upload(req, res, url) {
    const to = url.searchParams.get("to");
    const name = url.searchParams.get("name");
    if (!to || !name || !to.startsWith(ROOT)) {
        res.writeHead(400);
        res.end("bad destination");
        return;
    }
    fs.mkdirSync(to, { recursive: true });
    const dest = path.join(to, name);
    const stream = fs.createWriteStream(dest);
    req.pipe(stream);
    stream.on("finish", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, path: dest }));
    });
    stream.on("error", (e) => {
        res.writeHead(500);
        res.end(e.message);
    });
}

// ---------------------------------------------------------------------------
// POST /shutdown — close the server so the CLI returns to bash
// ---------------------------------------------------------------------------
function shutdown(res) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
}

// ---------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>drop — development file dropper</title>
<style>
  :root {
    --bg: #1e1e1e; --fg: #d4d4d4; --accent: #4ec9b0; --dim: #666;
    --sel: #264f78; --border: #333;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 14px/1.5 "Cascadia Code", "JetBrains Mono", monospace;
    background: var(--bg); color: var(--fg);
    display: grid; grid-template-rows: auto 1fr auto; height: 100vh;
  }
  header {
    padding: 8px 16px; border-bottom: 1px solid var(--border);
    display: flex; gap: 16px; align-items: center;
  }
  header h1 { font-size: 16px; margin: 0; color: var(--accent); }
  header .hint { color: var(--dim); font-size: 12px; }
  main { display: grid; grid-template-columns: 360px 1fr; overflow: hidden; }
  #sidebar { border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  #filter-bar { padding: 8px; border-bottom: 1px solid var(--border); display: flex; gap: 8px; }
  #filter {
    flex: 1; background: #2d2d2d; border: 1px solid var(--border);
    color: var(--fg); padding: 4px 8px; font: inherit; border-radius: 2px;
  }
  #filter:focus { outline: 1px solid var(--accent); }
  #dir-count { color: var(--dim); font-size: 12px; align-self: center; min-width: 60px; text-align: right; }
  #dir-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  #dir-list li {
    padding: 4px 16px; cursor: pointer; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  #dir-list li.selected { background: var(--sel); color: #fff; }
  #dir-list li:hover { background: #2a2d2e; }
  #dir-list .rel { color: var(--dim); }
  #dir-list .basename { color: var(--fg); }
  #dropzone-wrap { display: flex; flex-direction: column; overflow: hidden; }
  #dropzone {
    flex: 1; margin: 16px; border: 2px dashed var(--border); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--dim); transition: all 0.15s; position: relative;
  }
  #dropzone.over { border-color: var(--accent); color: var(--accent); background: rgba(78,201,176,0.05); }
  #dropzone canvas { width: 100%; height: 100%; display: block; }
  #dropzone .placeholder { position: absolute; pointer-events: none; text-align: center; }
  #dropzone.over .placeholder { display: none; }
  #log-wrap { border-top: 1px solid var(--border); height: 160px; display: flex; flex-direction: column; }
  #log-header { padding: 4px 16px; color: var(--dim); font-size: 12px; border-bottom: 1px solid var(--border); }
  #log { list-style: none; margin: 0; padding: 4px 16px; overflow-y: auto; flex: 1; font-size: 12px; }
  #log .ok { color: var(--accent); }
  #log .err { color: #f48771; }
  #log .info { color: var(--dim); }
  footer { padding: 4px 16px; border-top: 1px solid var(--border); color: var(--dim); font-size: 12px; display: flex; justify-content: space-between; }
  #dest-display { color: var(--accent); }
  kbd {
    background: #2d2d2d; border: 1px solid var(--border); border-radius: 2px;
    padding: 0 4px; font-size: 11px; color: var(--fg);
  }
</style>
</head>
<body>
<header>
  <h1>drop</h1>
  <span class="hint">
    <kbd>/</kbd> filter &nbsp;
    <kbd>j</kbd>/<kbd>k</kbd> navigate &nbsp;
    <kbd>Enter</kbd> confirm destination &nbsp;
    <kbd>Esc</kbd> clear &nbsp;
    <kbd>q</kbd> quit &nbsp;
    drag files onto the canvas
  </span>
</header>
<main>
  <div id="sidebar">
    <div id="filter-bar">
      <input id="filter" type="text" placeholder="/ to filter directories…" autocomplete="off">
      <span id="dir-count">0</span>
    </div>
    <ul id="dir-list" tabindex="0"></ul>
  </div>
  <div id="dropzone-wrap">
    <div id="dropzone">
      <canvas id="bg-canvas"></canvas>
      <div class="placeholder">
        drag files from Windows here<br>
        <span style="font-size:12px;color:var(--dim)">drop into: <span id="dest-display">…</span></span>
      </div>
    </div>
    <div id="log-wrap">
      <div id="log-header">log</div>
      <ul id="log"></ul>
    </div>
  </div>
</main>
<footer>
  <span>destination: <span id="dest-footer">…</span></span>
  <span id="status">ready</span>
</footer>

<script>
const ROOT = ${JSON.stringify(ROOT)};
let dirs = [];
let filtered = [];
let selIdx = 0;
let dest = ROOT;

const filterEl = document.getElementById("filter");
const listEl = document.getElementById("dir-list");
const countEl = document.getElementById("dir-count");
const dropzone = document.getElementById("dropzone");
const logEl = document.getElementById("log");
const destDisplay = document.getElementById("dest-display");
const destFooter = document.getElementById("dest-footer");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

// ---- directory loading ----
async function loadDirs() {
  const r = await fetch("/dirs");
  dirs = await r.json();
  render();
}

function render() {
  const q = filterEl.value.trim().toLowerCase();
  filtered = q
    ? dirs.filter(d => d.toLowerCase().includes(q))
    : dirs;
  if (selIdx >= filtered.length) selIdx = Math.max(0, filtered.length - 1);
  countEl.textContent = filtered.length + (q ? "/" + dirs.length : "");
  listEl.innerHTML = "";
  filtered.forEach((d, i) => {
    const li = document.createElement("li");
    if (i === selIdx) li.classList.add("selected");
    const rel = d.startsWith(ROOT + "/") ? d.slice(ROOT.length + 1) : d;
    const parts = rel.split("/");
    const basename = parts.pop();
    li.innerHTML = '<span class="rel">' + parts.join("/") + (parts.length ? "/" : "") + '</span><span class="basename">' + basename + '</span>';
    li.onclick = () => { selIdx = i; confirmDest(); };
    listEl.appendChild(li);
  });
  const sel = listEl.querySelector(".selected");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function setDest(d) {
  dest = d;
  destDisplay.textContent = d;
  destFooter.textContent = d;
}

function confirmDest() {
  if (filtered[selIdx]) setDest(filtered[selIdx]);
  filterEl.blur();
  listEl.focus();
}

// ---- keyboard ----
filterEl.addEventListener("input", render);
filterEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); confirmDest(); }
  if (e.key === "Escape") { filterEl.value = ""; render(); }
  if (e.key === "j" || e.key === "ArrowDown") {
    e.preventDefault();
    if (selIdx < filtered.length - 1) { selIdx++; render(); }
  }
  if (e.key === "k" || e.key === "ArrowUp") {
    e.preventDefault();
    if (selIdx > 0) { selIdx--; render(); }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== filterEl) {
    e.preventDefault();
    filterEl.focus();
    filterEl.select();
  }
  if (e.key === "j" && document.activeElement === listEl) {
    e.preventDefault();
    if (selIdx < filtered.length - 1) { selIdx++; render(); }
  }
  if (e.key === "k" && document.activeElement === listEl) {
    e.preventDefault();
    if (selIdx > 0) { selIdx--; render(); }
  }
  if (e.key === "Enter" && document.activeElement === listEl) {
    e.preventDefault();
    confirmDest();
  }
  if (e.key === "q" && document.activeElement !== filterEl) {
    e.preventDefault();
    fetch("/shutdown", { method: "POST" }).finally(() => {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#666;font:14px/1.5 monospace">server stopped — you can close this tab</div>';
    });
  }
});

// ---- drag & drop ----
["dragenter", "dragover"].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("over"); drawBg(true); })
);
["dragleave", "drop"].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("over"); drawBg(false); })
);
dropzone.addEventListener("drop", async e => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  for (const f of files) await uploadFile(f);
});

async function uploadFile(file) {
  const url = "/upload?to=" + encodeURIComponent(dest) + "&name=" + encodeURIComponent(file.name);
  statusEl.textContent = "uploading " + file.name + "…";
  logMsg("info", "↑ " + file.name + " (" + formatBytes(file.size) + ") → " + dest);
  try {
    const r = await fetch(url, { method: "POST", body: file });
    const j = await r.json();
    if (r.ok) {
      logMsg("ok", "✓ " + file.name + " → " + j.path);
    } else {
      logMsg("err", "✗ " + file.name + ": " + JSON.stringify(j));
    }
  } catch (err) {
    logMsg("err", "✗ " + file.name + ": " + err.message);
  }
  statusEl.textContent = "ready";
}

function logMsg(cls, msg) {
  const li = document.createElement("li");
  li.className = cls;
  li.textContent = msg;
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

function formatBytes(n) {
  if (n < 1024) return n + "B";
  if (n < 1048576) return (n / 1024).toFixed(1) + "KB";
  return (n / 1048576).toFixed(1) + "MB";
}

// ---- background canvas ----
function drawBg(active) {
  const w = canvas.width = dropzone.clientWidth;
  const h = canvas.height = dropzone.clientHeight;
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = active ? "#4ec9b0" : "#333";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}
window.addEventListener("resize", () => drawBg(dropzone.classList.contains("over")));

// ---- shutdown on tab close ----
window.addEventListener("beforeunload", () => {
  navigator.sendBeacon("/shutdown", "");
});

// ---- init ----
setDest(ROOT);
drawBg(false);
loadDirs();
filterEl.focus();
</script>
</body>
</html>`;