# PowerShell Authentication Test Script

$API_URL = "http://localhost:5000"

Write-Host "`n🧪 Testing Authentication System`n" -ForegroundColor Yellow

# Test 1: Login
Write-Host "Test 1: Login with credentials" -ForegroundColor Yellow
$username = Read-Host "Enter username (default: admin)"
if ([string]::IsNullOrEmpty($username)) { $username = "admin" }
$password = Read-Host "Enter password" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

$loginBody = @{
    username = $username
    password = $passwordPlain
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login successful" -ForegroundColor Green
    $token = $loginResponse.token
    Write-Host "Token: $($token.Substring(0, 50))...`n"
} catch {
    Write-Host "❌ Login failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Test 2: Verify token
Write-Host "Test 2: Verify token" -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $token"
    }
    $verifyResponse = Invoke-RestMethod -Uri "$API_URL/verify" -Headers $headers
    Write-Host "✅ Token verification successful`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Token verification failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test 3: Access protected route
Write-Host "Test 3: Access protected route (/images)" -ForegroundColor Yellow
try {
    $imagesResponse = Invoke-RestMethod -Uri "$API_URL/images?page=1&limit=5" -Headers $headers
    Write-Host "✅ Protected route access successful`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Protected route access failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test 4: Access without token (should fail)
Write-Host "Test 4: Access without token (should fail)" -ForegroundColor Yellow
try {
    $noTokenResponse = Invoke-RestMethod -Uri "$API_URL/images"
    Write-Host "❌ Security issue: Unauthorized access allowed" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly blocked unauthorized access`n" -ForegroundColor Green
}

# Test 5: Logout
Write-Host "Test 5: Logout" -ForegroundColor Yellow
try {
    $logoutResponse = Invoke-RestMethod -Uri "$API_URL/logout" -Method Post -Headers $headers
    Write-Host "✅ Logout successful`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Logout failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Test 6: Try to use revoked token (should fail)
Write-Host "Test 6: Try to use revoked token (should fail)" -ForegroundColor Yellow
try {
    $revokedResponse = Invoke-RestMethod -Uri "$API_URL/images" -Headers $headers
    Write-Host "❌ Security issue: Revoked token still works" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly blocked revoked token`n" -ForegroundColor Green
}

# Test 7: Login with wrong credentials (should fail)
Write-Host "Test 7: Login with wrong credentials (should fail)" -ForegroundColor Yellow
$wrongBody = @{
    username = "admin"
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $wrongLogin = Invoke-RestMethod -Uri "$API_URL/login" -Method Post -Body $wrongBody -ContentType "application/json"
    Write-Host "❌ Security issue: Wrong credentials accepted" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected wrong credentials`n" -ForegroundColor Green
}

Write-Host "🎉 All tests completed!" -ForegroundColor Green
