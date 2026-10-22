param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$PairingCode,
  [ValidateSet('https://minemath-academy-bridge.ulyssesyu8.chatgpt.site','http://127.0.0.1:4173')][string]$CourseOrigin = 'https://minemath-academy-bridge.ulyssesyu8.chatgpt.site',
  [string]$DshDirectory = '',
  [switch]$PlanOnly
)
$ErrorActionPreference = 'Stop'
$pluginVersion = '0.2.2'
$expectedPluginHash = '2e24a2c7c2a8948b45a2188f3a0c80ffb770e568fd4ffd4bfd8d5fb2591ea0c1'
if (-not $DshDirectory) {
  $taskCandidates = @((Join-Path $env:LOCALAPPDATA 'Programs/DeepSeek Harness'), (Join-Path $env:USERPROFILE 'AppData/Local/Programs/DeepSeek Harness'), (Join-Path $env:ProgramFiles 'DeepSeek Harness'))
  $DshDirectory = $taskCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'resources/runtime/cli/bin/dsh.cmd') -PathType Leaf } | Select-Object -First 1
}
if (-not $DshDirectory) { throw 'Open and sign into the Windows DSH desktop app first. Its installation was not found.' }
$dshCommand = Join-Path $DshDirectory 'resources/runtime/cli/bin/dsh.cmd'
$runtimePath = Join-Path $DshDirectory 'resources/runtime/primary-runtime/runtime.json'
if (-not (Test-Path -LiteralPath $dshCommand -PathType Leaf) -or -not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'This is not a recognized DSH desktop installation.' }
$runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
if ($runtime.desktopVersion -ne '0.2.1-rc.2') { throw ('MathBridge has verified DSH 0.2.1-rc.2. Found ' + $runtime.desktopVersion + '; configuration was left unchanged.') }
$dshHomeDirectory = if ($env:DSH_HOME) { [IO.Path]::GetFullPath($env:DSH_HOME) } else { Join-Path $env:USERPROFILE '.dsh' }
$profileDirectory = Join-Path $dshHomeDirectory 'profiles/desktop'
$profileManifest = Join-Path $profileDirectory 'package.json'
if (-not (Test-Path -LiteralPath $profileManifest -PathType Leaf)) { throw 'Open DSH desktop once to initialize its desktop profile, then retry.' }
$profile = Get-Content -LiteralPath $profileManifest -Raw | ConvertFrom-Json
if ($profile.name -ne 'dsh-profile-desktop') { throw 'The desktop profile is not recognized; configuration was left unchanged.' }
$channel = if ($CourseOrigin.StartsWith('https://')) { 'online' } else { 'local' }
$applicationDirectory = Join-Path $env:USERPROFILE ('AppData/Local/MathBridge/connect-' + $channel)
$configDirectory = Join-Path $applicationDirectory 'connection'
if ($PlanOnly) { Write-Output ('MATHBRIDGE_PLAN: DSH=' + $runtime.desktopVersion + '; connector=' + $pluginVersion + '; channel=' + $channel + '; profile=desktop; configuration bundle only; no account credentials read.'); return }
if ($expectedPluginHash -notmatch '^[a-f0-9]{64}$') { throw 'Use the packaged installer from the course website.' }
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$archive = Join-Path $applicationDirectory ('mathbridge-dsh-connect-' + $pluginVersion + '.tgz')
$download = $archive + '.download'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri ($CourseOrigin + '/connect/' + $pluginVersion + '/mathbridge-dsh-connect-' + $pluginVersion + '.tgz') -OutFile $download -MaximumRedirection 0 -UseBasicParsing -TimeoutSec 60
$archiveHash = [Security.Cryptography.SHA256]::Create()
$archiveStream = [IO.File]::OpenRead($download)
try { $actualPluginHash = ([BitConverter]::ToString($archiveHash.ComputeHash($archiveStream))).Replace('-','').ToLowerInvariant() } finally { $archiveStream.Dispose(); $archiveHash.Dispose() }
if ((Get-Item -LiteralPath $download).Length -gt 2097152 -or $actualPluginHash -ne $expectedPluginHash) { Remove-Item -LiteralPath $download -Force; throw 'Connector checksum verification failed. Nothing was installed.' }
Move-Item -LiteralPath $download -Destination $archive -Force
$backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item -LiteralPath $profileManifest -Destination (Join-Path $applicationDirectory ('profile-' + $backupStamp + '.json.bak'))
$profilePatch = Join-Path $profileDirectory 'cordis.patch.yml'
if (Test-Path -LiteralPath $profilePatch -PathType Leaf) { Copy-Item -LiteralPath $profilePatch -Destination (Join-Path $applicationDirectory ('profile-' + $backupStamp + '.yml.bak')) }
& $dshCommand plugin --profile desktop add --offline --ignore-scripts $archive
if ($LASTEXITCODE -ne 0) { throw 'DSH could not install the verified connector. Existing configuration backups were retained.' }
$configName = 'mathbridge-dsh-connection-' + $channel
$pairBytes = [Text.Encoding]::UTF8.GetBytes($PairingCode)
$sha = [Security.Cryptography.SHA256]::Create()
try { $nonce = ([BitConverter]::ToString($sha.ComputeHash($pairBytes))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
$connectionVersion = $pluginVersion + '-pair.p' + $nonce.Substring(0,12)
$manifest = @{ name=$configName; version=$connectionVersion; private=$true; main='index.js'; files=@('index.js','cordis.patch.yml'); dsh=@{ bundle=@{ patch='./cordis.patch.yml' } } } | ConvertTo-Json -Depth 5
$endpoint = $CourseOrigin + '/api/dsh-tutor/bridge/'
$slot = if ($channel -eq 'local') { 'quick-local' } else { '' }
$patch = @"
- insert:
    - id: mathbridge-connect-$channel
      name: mathbridge-dsh-connect
      config:
        endpoint: '$endpoint'
        pairingCode: '$PairingCode'
        pairingNonce: '$nonce'
        bridgeSlot: '$slot'
        connectorVersion: '$pluginVersion'
"@
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $configDirectory 'package.json'), $manifest, $utf8)
[IO.File]::WriteAllText((Join-Path $configDirectory 'index.js'), "module.exports = {};" + [Environment]::NewLine, $utf8)
[IO.File]::WriteAllText((Join-Path $configDirectory 'cordis.patch.yml'), $patch + [Environment]::NewLine, $utf8)
& $dshCommand plugin --profile desktop --dir $configDirectory pack --pack-destination $applicationDirectory --config.ignore-scripts=true
if ($LASTEXITCODE -ne 0) { throw 'DSH could not package MathBridge connection settings.' }
$connectionArchive = Join-Path $applicationDirectory ($configName + '-' + $connectionVersion + '.tgz')
if (-not (Test-Path -LiteralPath $connectionArchive -PathType Leaf)) { throw 'The MathBridge connection archive was not created.' }
$currentProfile = Get-Content -LiteralPath $profileManifest -Raw | ConvertFrom-Json
if ($currentProfile.dependencies.PSObject.Properties[$configName]) {
  & $dshCommand plugin --profile desktop remove --config.offline=true --config.ignore-scripts=true $configName
  if ($LASTEXITCODE -ne 0) { throw 'DSH could not replace the previous MathBridge connection settings.' }
}
& $dshCommand plugin --profile desktop add --offline --ignore-scripts $connectionArchive
if ($LASTEXITCODE -ne 0) { throw 'DSH could not install MathBridge connection settings. No DSH process was stopped.' }
if ($channel -eq 'online') {
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    try {
      $receipt = Invoke-RestMethod -Method Post -Uri ($CourseOrigin + '/api/dsh-tutor/bridge/receipt') -ContentType 'application/json' -Body (@{code=$PairingCode} | ConvertTo-Json -Compress) -MaximumRedirection 0 -TimeoutSec 10
      if ($receipt.connected -eq $true) {
        if ($receipt.modelCount -gt 0) { Write-Output 'MATHBRIDGE_CONNECTED: Website confirmed the paired DSH heartbeat and account models. Return to the course and ask your question.' }
        else { Write-Output 'MATHBRIDGE_PAIRED_NO_MODELS: Website confirmed pairing. Check DSH sign-in and account model availability.' }
        return
      }
    } catch { }
    Start-Sleep -Seconds 3
  }
}
Write-Output 'MATHBRIDGE_WAITING: Installed; connection is not yet verified. Keep the website open. If the plugin did not activate, save work and reopen DSH; do not enter credentials into the website.'
