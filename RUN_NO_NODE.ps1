Set-Location $PSScriptRoot
if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 .\run_no_node.py
  exit $LASTEXITCODE
}
if (Get-Command python -ErrorAction SilentlyContinue) {
  & python .\run_no_node.py
  exit $LASTEXITCODE
}
Write-Error "Python 3 is required for the included local web server. Node.js is not required. Alternatively, serve the dist/ folder with any static HTTP server."
exit 1
