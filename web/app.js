const $ = (id) => document.getElementById(id);
let api = localStorage.getItem("kumaedge.api") || "";
let targets = [];
$("api").value = api;
function status(message) { $("api-status").textContent = message; }
function line(target, result) {
  const item = document.createElement("article");
  item.className = "monitor";
  const info = document.createElement("div");
  const h = document.createElement("h3"); h.textContent = target.name;
  const small = document.createElement("small"); small.textContent = target.url;
  info.append(h, small);
  const label = document.createElement("span");
  label.className = "state " + (result ? result.up ? "up" : "down" : "unknown");
  label.textContent = result ? result.up ? "UP · " + result.durationMs + " ms" : "DOWN · " + (result.status ?? "network") : "NOT CHECKED";
  item.append(info,label);
  return item;
}
async function get(path) {
  const response = await fetch(api + path, {cache:"no-store", signal:AbortSignal.timeout(11000)});
  if (!response.ok) throw new Error("API returned HTTP " + response.status);
  return response.json();
}
async function load() {
  if (!api) {status("Not connected"); return;}
  status("Connecting…");
  try {
    await get("/health");
    const data = await get("/api/targets");
    if (!Array.isArray(data.targets)) throw new Error("Invalid target list");
    targets = data.targets;
    $("target-count").textContent = String(targets.length);
    $("monitors").replaceChildren(...targets.map(t => line(t,null)));
    status("Connected");
  } catch (error) { status("Offline"); $("monitors").textContent = "Connection failed: " + error.message; }
}
$("settings").addEventListener("submit", e => {
  e.preventDefault();
  try {
    const url = new URL($("api").value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Enter an HTTPS base URL without credentials or query");
    api = url.origin + url.pathname.replace(/\/$/,"");
    localStorage.setItem("kumaedge.api",api);
    load();
  } catch(error){status(error.message);}
});
$("refresh").addEventListener("click",async () => {
  if (!api || !targets.length) return;
  $("refresh").disabled=true;
  const results = await Promise.all(targets.map(async t => {
    try {return await get("/api/check?id=" + encodeURIComponent(t.id));}
    catch {return {up:false,status:null};}
  }));
  $("monitors").replaceChildren(...targets.map((t,i)=>line(t,results[i])));
  $("last-refresh").textContent=new Date().toLocaleTimeString();
  $("refresh").disabled=false;
});
load();
