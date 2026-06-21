# Build the staff-app once per role with a relative API base (NEXT_PUBLIC_API_URL="")
# and BASE_PATH=/<role>, then mirror out/ into backend/public/<role> (served at
# localhost:8000/<role>) and a local out-<role> staging snapshot.
$ErrorActionPreference = "Stop"
$roles = @("admin", "state", "district", "taluk", "vendor")
$env:NEXT_PUBLIC_API_URL = ""   # relative /api/v1 — works on localhost:8000 and prod

foreach ($r in $roles) {
  Write-Output "=== BUILD $r ==="
  $env:BASE_PATH = "/$r"
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Output "BUILD FAILED: $r"; exit 1 }
  robocopy out "..\backend\public\$r" /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  robocopy out "out-$r"               /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Output "=== DONE $r ==="
}
Write-Output "ALL ROLES BUILT"
exit 0
