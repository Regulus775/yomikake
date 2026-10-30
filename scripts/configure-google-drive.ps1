param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$')]
    [string]$ClientId
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$encoding = New-Object System.Text.UTF8Encoding($false)
$pattern = "(?m)^const GOOGLE_CLIENT_ID = '[^']*';"
$updates = @()

# Validate both files before writing either one. Keep upstream source changes minimal.
foreach ($name in @('yomikake.html', 'yomikake_ios.html')) {
    $path = Join-Path $repoRoot $name
    $source = [System.IO.File]::ReadAllText($path, $encoding)
    if ([regex]::Matches($source, $pattern).Count -ne 1) {
        throw "Expected exactly one GOOGLE_CLIENT_ID declaration in $name. No files were changed."
    }
    $updates += @{ Path = $path; Text = [regex]::Replace($source, $pattern, "const GOOGLE_CLIENT_ID = '$ClientId';") }
}

foreach ($update in $updates) {
    [System.IO.File]::WriteAllText($update.Path, $update.Text, $encoding)
}
Write-Host 'Configured Google Drive client ID in both HTML files.'
Write-Host 'Next: node tests/lib/syntax-check.js yomikake.html yomikake_ios.html'
Write-Host 'Register the HTTPS site origin in Google Cloud, then publish to your own repository.'
