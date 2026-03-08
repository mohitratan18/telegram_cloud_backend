# PowerShell Health Monitor Script
# Checks API health every 1 second and logs status

param(
    [string]$ApiUrl = "http://localhost:5000"
)

$CheckInterval = 1 # seconds
$consecutiveFailures = 0
$consecutiveSuccesses = 0
$totalChecks = 0
$totalFailures = 0

function Get-Timestamp {
    return Get-Date -Format "HH:mm:ss"
}

function Write-HealthLog {
    param(
        [int]$StatusCode,
        [object]$Data
    )
    
    $script:totalChecks++
    $timestamp = Get-Timestamp
    $status = if ($Data.status) { $Data.status } else { "unknown" }
    
    if ($StatusCode -eq 200) {
        $script:consecutiveSuccesses++
        $script:consecutiveFailures = 0
        
        $uptime = [math]::Floor($Data.uptime)
        $dbStatus = if ($Data.checks.database) { $Data.checks.database } else { "unknown" }
        $telegramStatus = if ($Data.checks.telegram) { $Data.checks.telegram } else { "unknown" }
        $storageStatus = if ($Data.checks.storage) { $Data.checks.storage } else { "unknown" }
        
        Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
        Write-Host "✓ $StatusCode" -NoNewline -ForegroundColor Green
        Write-Host " - Status: " -NoNewline
        Write-Host $status.ToUpper() -NoNewline -ForegroundColor Green
        Write-Host " | Uptime: ${uptime}s | DB: " -NoNewline
        
        if ($dbStatus -eq "healthy") {
            Write-Host $dbStatus -NoNewline -ForegroundColor Green
        } else {
            Write-Host $dbStatus -NoNewline -ForegroundColor Red
        }
        
        Write-Host " | Telegram: " -NoNewline
        if ($telegramStatus -eq "healthy") {
            Write-Host $telegramStatus -NoNewline -ForegroundColor Green
        } else {
            Write-Host $telegramStatus -NoNewline -ForegroundColor Red
        }
        
        Write-Host " | Storage: " -NoNewline
        if ($storageStatus -eq "healthy") {
            Write-Host $storageStatus -ForegroundColor Green
        } else {
            Write-Host $storageStatus -ForegroundColor Red
        }
    }
    else {
        $script:consecutiveFailures++
        $script:consecutiveSuccesses = 0
        $script:totalFailures++
        
        Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
        Write-Host "✗ $StatusCode" -NoNewline -ForegroundColor Red
        Write-Host " - Status: " -NoNewline
        Write-Host $status.ToUpper() -ForegroundColor Red
        
        if ($Data.checks) {
            foreach ($key in $Data.checks.Keys) {
                if ($key -like "*Error*") {
                    Write-Host "  └─ ${key}: $($Data.checks[$key])" -ForegroundColor Red
                }
            }
        }
    }
    
    # Alert on consecutive failures
    if ($script:consecutiveFailures -eq 5) {
        Write-Host "⚠️  WARNING: 5 consecutive health check failures!" -ForegroundColor Red
    }
    elseif ($script:consecutiveFailures -eq 10) {
        Write-Host "🚨 CRITICAL: 10 consecutive health check failures!" -ForegroundColor Red
    }
    
    # Show recovery message
    if ($script:consecutiveSuccesses -eq 1 -and $script:totalChecks -gt 1) {
        Write-Host "✓ Service recovered after $script:totalFailures total failures" -ForegroundColor Green
    }
}

function Write-ErrorLog {
    param(
        [string]$ErrorMessage
    )
    
    $script:totalChecks++
    $script:totalFailures++
    $script:consecutiveFailures++
    $script:consecutiveSuccesses = 0
    
    $timestamp = Get-Timestamp
    
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
    Write-Host "✗ ERROR" -NoNewline -ForegroundColor Red
    Write-Host " - $ErrorMessage" -ForegroundColor Red
}

function Test-Health {
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method Get -TimeoutSec 5 -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        Write-HealthLog -StatusCode $response.StatusCode -Data $data
    }
    catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $data = $responseBody | ConvertFrom-Json
                Write-HealthLog -StatusCode $statusCode -Data $data
            }
            catch {
                Write-ErrorLog -ErrorMessage "Status $statusCode - $($_.Exception.Message)"
            }
        }
        else {
            Write-ErrorLog -ErrorMessage $_.Exception.Message
        }
    }
}

# Print header
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          API Health Monitor - Checking every 1s            ║" -ForegroundColor Cyan
Write-Host "║  Target: $($ApiUrl.PadRight(48)) ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Start monitoring
try {
    while ($true) {
        Test-Health
        Start-Sleep -Seconds $CheckInterval
    }
}
finally {
    # Print summary on exit (Ctrl+C)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                    Monitoring Summary                      ║" -ForegroundColor Cyan
    Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "║  Total Checks: $($totalChecks.ToString().PadRight(44)) ║" -ForegroundColor Cyan
    Write-Host "║  Total Failures: $($totalFailures.ToString().PadRight(42)) ║" -ForegroundColor Cyan
    
    if ($totalChecks -gt 0) {
        $successRate = [math]::Round((($totalChecks - $totalFailures) / $totalChecks * 100), 2)
        Write-Host "║  Success Rate: $($successRate)%".PadRight(59) " ║" -ForegroundColor Cyan
    }
    
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}
