param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$ReportPath = '',
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\', '/')
if (!(Test-Path -LiteralPath (Join-Path $projectPath 'AGENTS.md') -PathType Leaf)) { throw 'Project root must contain AGENTS.md.' }
$tempPath = Join-Path $projectPath 'temp'
if (!(Test-Path -LiteralPath $tempPath -PathType Container)) { throw 'Project temp directory is missing.' }
foreach ($boundary in @($projectPath, $tempPath)) {
  if ((Get-Item -LiteralPath $boundary).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Root boundaries cannot be reparse points.' }
}
if (!$ReportPath) { $ReportPath = Join-Path $projectPath 'docs/qa/firstplay/cleanup-report.json' }
$reportAbsolute = [IO.Path]::GetFullPath($ReportPath)
if (!$reportAbsolute.StartsWith($projectPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Report must stay inside the project.' }
$trackedPaths = @()
if (Test-Path -LiteralPath (Join-Path $projectPath '.git')) {
  $trackedPaths = @(& git -C $projectPath ls-files -- 'temp/cocos-ui-qa-*/browser-profile/**')
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify tracked files; nothing removed.' }
}
$processCheckAvailable = $true
try { $chromeProcesses = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction Stop) }
catch { $chromeProcesses = @(); $processCheckAvailable = $false }
$records = @()
foreach ($qaFolder in @(Get-ChildItem -LiteralPath $tempPath -Directory -Filter 'cocos-ui-qa-*')) {
  if ($qaFolder.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
  $candidatePath = Join-Path $qaFolder.FullName 'browser-profile'
  if (!(Test-Path -LiteralPath $candidatePath -PathType Container)) { continue }
  $targetDir = Get-Item -LiteralPath $candidatePath -Force
  $absoluteTarget = [IO.Path]::GetFullPath($targetDir.FullName)
  if (!$absoluteTarget.StartsWith($tempPath + '\', [StringComparison]::OrdinalIgnoreCase) -or $targetDir.Name -ne 'browser-profile' -or $targetDir.Parent.Name -notlike 'cocos-ui-qa-*') { throw 'Unsafe cleanup target.' }
  $entries = if ($targetDir.Attributes -band [IO.FileAttributes]::ReparsePoint) { @() } else { @(Get-ChildItem -LiteralPath $absoluteTarget -Recurse -Force -ErrorAction SilentlyContinue) }
  $bytesBefore = [long]0
  foreach ($entry in $entries) { if (!$entry.PSIsContainer) { $bytesBefore += $entry.Length } }
  $relativeTarget = $absoluteTarget.Substring($projectPath.Length + 1).Replace('\', '/') + '/'
  $containsTracked = @($trackedPaths | Where-Object { $_.StartsWith($relativeTarget, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
  $inUse = @($chromeProcesses | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($absoluteTarget, [StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count -gt 0
  $hasReparse = ($targetDir.Attributes -band [IO.FileAttributes]::ReparsePoint) -or @($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0
  $status = if ($hasReparse) { 'reparse_skipped' } elseif ($containsTracked) { 'tracked_skipped' } elseif (!$processCheckAvailable) { 'process_check_failed' } elseif ($inUse) { 'in_use_skipped' } else { 'planned' }
  $bytesAfter = $bytesBefore
  $failure = ''
  if ($Apply -and $status -eq 'planned') {
    # Recheck the literal absolute target immediately before recursive deletion.
    $resolvedTarget = (Resolve-Path -LiteralPath $absoluteTarget).Path
    if ($resolvedTarget -ne $absoluteTarget -or !(Test-Path -LiteralPath (Join-Path $targetDir.Parent.FullName 'browser-profile') -PathType Container)) { throw 'Cleanup target changed.' }
    try { Remove-Item -LiteralPath $resolvedTarget -Recurse -Force -ErrorAction Stop; $status = 'deleted'; $bytesAfter = 0 }
    catch {
      $status = 'failed'; $failure = $_.Exception.Message; $bytesAfter = [long]0
      if (Test-Path -LiteralPath $absoluteTarget) {
        foreach ($remaining in @(Get-ChildItem -LiteralPath $absoluteTarget -File -Recurse -Force -ErrorAction SilentlyContinue)) { $bytesAfter += $remaining.Length }
      }
    }
  }
  $records += [pscustomobject]@{ path=$absoluteTarget; status=$status; bytesBefore=$bytesBefore; bytesAfter=$bytesAfter; freedBytes=($bytesBefore-$bytesAfter); error=$failure }
}
$totalBefore = [long]0; $totalAfter = [long]0
foreach ($record in $records) { $totalBefore += $record.bytesBefore; $totalAfter += $record.bytesAfter }
$report = [pscustomobject]@{
  projectRoot=$projectPath; apply=[bool]$Apply; processCheckAvailable=$processCheckAvailable;
  profileCount=$records.Count; bytesBefore=$totalBefore; bytesAfter=$totalAfter; freedBytes=($totalBefore-$totalAfter);
  deletedCount=@($records | Where-Object status -eq 'deleted').Count;
  skippedCount=@($records | Where-Object { $_.status -notin @('deleted','planned') }).Count;
  records=$records
}
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($reportAbsolute))
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportAbsolute -Encoding UTF8
Write-Output ($report | Select-Object apply,profileCount,deletedCount,skippedCount,freedBytes | ConvertTo-Json -Compress)
