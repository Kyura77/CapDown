param(
  [switch]$DryRun = $false,
  [string]$Config = "tools/ralph-loop/config.example.json"
)

$argsList = @("tools/ralph-loop/bin/run.mjs", "--config", $Config)

if ($DryRun) {
  $argsList += "--dry-run"
}

node @argsList
