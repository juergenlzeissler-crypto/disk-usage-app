$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null -and ($_.Used + $_.Free) -gt 0 } | ForEach-Object {
    $total = $_.Used + $_.Free
    $pct = [math]::Round(($_.Used / $total) * 100, 1)
    @{
        name  = $_.Name
        root  = $_.Root
        used  = $_.Used
        free  = $_.Free
        total = $total
        pct   = $pct
    }
}

function Format-Size($bytes) {
    if ($bytes -ge 1TB) { return "{0:N2} TB" -f ($bytes / 1TB) }
    if ($bytes -ge 1GB) { return "{0:N2} GB" -f ($bytes / 1GB) }
    if ($bytes -ge 1MB) { return "{0:N2} MB" -f ($bytes / 1MB) }
    return "{0:N2} KB" -f ($bytes / 1KB)
}

$hostname = $env:COMPUTERNAME
$timestamp = Get-Date -Format "dd.MM.yyyy HH:mm:ss"

$driveCards = ""
$donutItems = ""

foreach ($d in $drives) {
    $usedFmt = Format-Size $d.used
    $freeFmt = Format-Size $d.free
    $totalFmt = Format-Size $d.total
    $pct = $d.pct

    if ($pct -lt 60) { $barClass = "bar-green"; $color = "#22c55e" }
    elseif ($pct -lt 80) { $barClass = "bar-yellow"; $color = "#eab308" }
    elseif ($pct -lt 90) { $barClass = "bar-orange"; $color = "#f97316" }
    else { $barClass = "bar-red"; $color = "#ef4444" }

    $circ = 2 * [math]::PI * 54
    $offset = $circ - ($circ * $pct / 100)

    $driveCards += @"
    <div class="drive-card">
      <div class="drive-header">
        <div class="drive-name">
          <div class="drive-icon">$($d.name):</div>
          <div class="drive-label"><h2>Laufwerk $($d.name):</h2><span>$($d.root)</span></div>
        </div>
        <div class="drive-percent" style="color:$color">$pct%</div>
      </div>
      <div class="bar-container"><div class="bar-fill $barClass" style="width:${pct}%"></div></div>
      <div class="stats">
        <div class="stat"><span class="stat-label">Belegt</span><span class="stat-value">$usedFmt</span></div>
        <div class="stat"><span class="stat-label">Frei</span><span class="stat-value">$freeFmt</span></div>
        <div class="stat"><span class="stat-label">Gesamt</span><span class="stat-value">$totalFmt</span></div>
      </div>
    </div>
"@

    $donutItems += @"
    <div class="donut-wrapper">
      <svg class="donut-svg" viewBox="0 0 120 120">
        <circle class="donut-track" cx="60" cy="60" r="54"/>
        <circle class="donut-fill" cx="60" cy="60" r="54" stroke="$color"
          stroke-dasharray="$circ" stroke-dashoffset="$offset"/>
        <text class="donut-text" x="60" y="60" transform="rotate(90 60 60)">$pct%</text>
      </svg>
      <h3>$($d.name):\</h3>
    </div>
"@
}

$html = @"
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Laufwerksbelegung - $hostname</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    min-height: 100vh;
    padding: 40px 20px;
  }
  .container { max-width: 900px; margin: 0 auto; }
  h1 {
    text-align: center; font-size: 2rem; font-weight: 300;
    margin-bottom: 10px; color: #f1f5f9; letter-spacing: 1px;
  }
  .subtitle { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 0.9rem; }
  .hostname { color: #38bdf8; font-weight: 500; }
  .timestamp { color: #475569; }
  .drive-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 30px; margin-bottom: 24px;
    backdrop-filter: blur(10px);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .drive-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  }
  .drive-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .drive-name { display: flex; align-items: center; gap: 12px; }
  .drive-icon {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border-radius: 12px; display: flex; align-items: center;
    justify-content: center; font-size: 1.2rem; font-weight: 700;
  }
  .drive-label h2 { font-size: 1.3rem; font-weight: 600; }
  .drive-label span { color: #94a3b8; font-size: 0.85rem; }
  .drive-percent { font-size: 2.2rem; font-weight: 700; }
  .bar-container {
    width: 100%; height: 28px; background: rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden; margin-bottom: 16px;
  }
  .bar-fill {
    height: 100%; border-radius: 14px;
    transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
    min-width: 2%; position: relative;
  }
  .bar-green { background: linear-gradient(90deg, #22c55e, #4ade80); }
  .bar-yellow { background: linear-gradient(90deg, #eab308, #facc15); }
  .bar-orange { background: linear-gradient(90deg, #f97316, #fb923c); }
  .bar-red { background: linear-gradient(90deg, #ef4444, #f87171); }
  .stats { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .stat-value { font-size: 1rem; font-weight: 500; }
  .donut-section {
    display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;
    margin-top: 40px; padding: 30px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
  }
  .donut-wrapper { text-align: center; }
  .donut-wrapper h3 { margin-top: 12px; font-weight: 400; color: #94a3b8; }
  .donut-svg { width: 140px; height: 140px; transform: rotate(-90deg); }
  .donut-track { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 12; }
  .donut-fill { fill: none; stroke-width: 12; stroke-linecap: round; }
  .donut-text {
    font-size: 1.3rem; font-weight: 700; fill: #f1f5f9;
    dominant-baseline: central; text-anchor: middle;
  }
  .refresh-hint {
    text-align: center; margin-top: 30px; color: #475569; font-size: 0.85rem;
  }
</style>
</head>
<body>
<div class="container">
  <h1>Laufwerksbelegung</h1>
  <div class="subtitle">
    <span class="hostname">$hostname</span>
    <span class="timestamp"> &mdash; Stand: $timestamp</span>
  </div>
  $driveCards
  <div class="donut-section">
    $donutItems
  </div>
  <div class="refresh-hint">Erneut ausf&uuml;hren: <code>powershell -File disk-usage.ps1</code></div>
</div>
</body>
</html>
"@

$outPath = Join-Path $PSScriptRoot "disk-usage.html"
$html | Out-File -FilePath $outPath -Encoding utf8
Write-Host "Laufwerksbelegung gespeichert: $outPath"
Start-Process $outPath
