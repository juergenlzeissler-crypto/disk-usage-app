const http = require("http");
const { execSync } = require("child_process");
const os = require("os");

const PORT = 3456;

function getDiskInfo() {
  try {
    const raw = execSync(
      'powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | Select-Object Name, Used, Free, @{N=\'Total\';E={$_.Used + $_.Free}}, Root | ConvertTo-Json"',
      { encoding: "utf-8", timeout: 10000 }
    );
    const parsed = JSON.parse(raw);
    const drives = Array.isArray(parsed) ? parsed : [parsed];
    return drives
      .filter((d) => d.Total > 0)
      .map((d) => ({
        name: d.Name,
        root: d.Root,
        used: d.Used,
        free: d.Free,
        total: d.Total,
      }));
  } catch (e) {
    console.error("Error reading disk info:", e.message);
    return [];
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Laufwerksbelegung</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    min-height: 100vh;
    padding: 40px 20px;
  }
  .container { max-width: 900px; margin: 0 auto; }
  h1 {
    text-align: center;
    font-size: 2rem;
    font-weight: 300;
    margin-bottom: 10px;
    color: #f1f5f9;
    letter-spacing: 1px;
  }
  .subtitle {
    text-align: center;
    color: #64748b;
    margin-bottom: 40px;
    font-size: 0.9rem;
  }
  .hostname { color: #38bdf8; font-weight: 500; }
  .drive-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 24px;
    backdrop-filter: blur(10px);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .drive-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  }
  .drive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .drive-name {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .drive-icon {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
  }
  .drive-label h2 { font-size: 1.3rem; font-weight: 600; }
  .drive-label span { color: #94a3b8; font-size: 0.85rem; }
  .drive-percent {
    font-size: 2.2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .bar-container {
    width: 100%;
    height: 28px;
    background: rgba(255,255,255,0.08);
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 16px;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: 14px;
    transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    min-width: 2%;
  }
  .bar-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
    animation: shimmer 2s infinite;
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .bar-green { background: linear-gradient(90deg, #22c55e, #4ade80); }
  .bar-yellow { background: linear-gradient(90deg, #eab308, #facc15); }
  .bar-orange { background: linear-gradient(90deg, #f97316, #fb923c); }
  .bar-red { background: linear-gradient(90deg, #ef4444, #f87171); }
  .stats {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .stat-value { font-size: 1rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .donut-section {
    display: flex;
    justify-content: center;
    gap: 40px;
    flex-wrap: wrap;
    margin-top: 40px;
    padding: 30px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
  }
  .donut-wrapper { text-align: center; }
  .donut-wrapper h3 { margin-top: 12px; font-weight: 400; color: #94a3b8; }
  .donut-svg { width: 140px; height: 140px; transform: rotate(-90deg); }
  .donut-track { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 12; }
  .donut-fill { fill: none; stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1); }
  .donut-text {
    font-size: 1.3rem;
    font-weight: 700;
    fill: #f1f5f9;
    dominant-baseline: central;
    text-anchor: middle;
  }
  .refresh-btn {
    display: block;
    margin: 30px auto 0;
    padding: 10px 28px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.05);
    color: #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }
  .refresh-btn:hover { background: rgba(255,255,255,0.12); }
  .loading {
    text-align: center;
    padding: 60px;
    color: #64748b;
    font-size: 1.1rem;
  }
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
  <h1>Laufwerksbelegung</h1>
  <div class="subtitle"><span class="hostname" id="hostname"></span></div>
  <div id="drives">
    <div class="loading"><div class="spinner"></div>Laufwerke werden geladen...</div>
  </div>
  <div class="donut-section" id="donuts" style="display:none"></div>
  <button class="refresh-btn" onclick="loadDrives()">Aktualisieren</button>
</div>
<script>
function formatBytes(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b)/Math.log(1024));
  return (b/Math.pow(1024,i)).toFixed(2)+' '+u[i];
}
function barClass(pct) {
  if (pct < 60) return 'bar-green';
  if (pct < 80) return 'bar-yellow';
  if (pct < 90) return 'bar-orange';
  return 'bar-red';
}
function strokeColor(pct) {
  if (pct < 60) return '#22c55e';
  if (pct < 80) return '#eab308';
  if (pct < 90) return '#f97316';
  return '#ef4444';
}
async function loadDrives() {
  const res = await fetch('/api/drives');
  const data = await res.json();
  document.getElementById('hostname').textContent = data.hostname;
  const drivesEl = document.getElementById('drives');
  const donutsEl = document.getElementById('donuts');
  if (!data.drives.length) {
    drivesEl.innerHTML = '<div class="loading">Keine Laufwerke gefunden.</div>';
    donutsEl.style.display = 'none';
    return;
  }
  let html = '';
  let donutHtml = '';
  const circ = 2 * Math.PI * 54;
  data.drives.forEach((d, i) => {
    const pct = ((d.used / d.total) * 100).toFixed(1);
    const cls = barClass(pct);
    const color = strokeColor(pct);
    const offset = circ - (circ * pct / 100);
    html += '<div class="drive-card">'
      + '<div class="drive-header">'
      + '  <div class="drive-name">'
      + '    <div class="drive-icon">' + d.root.replace('\\\\','') + '</div>'
      + '    <div class="drive-label"><h2>Laufwerk ' + d.name + ':</h2>'
      + '    <span>' + d.root + '</span></div>'
      + '  </div>'
      + '  <div class="drive-percent" style="color:' + color + '">' + pct + '%</div>'
      + '</div>'
      + '<div class="bar-container"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>'
      + '<div class="stats">'
      + '  <div class="stat"><span class="stat-label">Belegt</span><span class="stat-value">' + d.usedFmt + '</span></div>'
      + '  <div class="stat"><span class="stat-label">Frei</span><span class="stat-value">' + d.freeFmt + '</span></div>'
      + '  <div class="stat"><span class="stat-label">Gesamt</span><span class="stat-value">' + d.totalFmt + '</span></div>'
      + '</div></div>';
    donutHtml += '<div class="donut-wrapper">'
      + '<svg class="donut-svg" viewBox="0 0 120 120">'
      + '<circle class="donut-track" cx="60" cy="60" r="54"/>'
      + '<circle class="donut-fill" cx="60" cy="60" r="54" stroke="' + color + '"'
      + ' stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>'
      + '<text class="donut-text" x="60" y="60" transform="rotate(90 60 60)">' + pct + '%</text>'
      + '</svg><h3>' + d.name + ':\\</h3></div>';
  });
  drivesEl.innerHTML = html;
  donutsEl.innerHTML = donutHtml;
  donutsEl.style.display = 'flex';
}
loadDrives();
setInterval(loadDrives, 30000);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/api/drives") {
    const drives = getDiskInfo().map((d) => ({
      ...d,
      usedFmt: formatBytes(d.used),
      freeFmt: formatBytes(d.free),
      totalFmt: formatBytes(d.total),
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hostname: os.hostname(), drives }));
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Disk Usage App running at ${url}`);
  // Open browser
  const { exec } = require("child_process");
  exec(`start ${url}`);
});
