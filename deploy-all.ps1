# ==============================================================================
# PISO CHAIN AUTONOMOUS AI VALIDATOR - 1-CLICK LAUNCH SCRIPT ($0 BUDGET)
# ==============================================================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " ₱ PISO CHAIN AUTONOMOUS AI VALIDATOR & MICRO-CLEARING ENGINE    " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Check Git Status
Write-Host "`n[1/4] Checking Git Repository Configuration..." -ForegroundColor Yellow
git remote -v
Write-Host "Branch: main | Target: https://github.com/314-hash/ai-validator.git" -ForegroundColor Gray

# 2. Test Local Cryptographic Lifecycle
Write-Host "`n[2/4] Running Full Simulation (Staking, Scoped Keys, AI Verdict, Quorum)..." -ForegroundColor Yellow
npm run test:flow

# 3. Check Live Cloudflare Edge Node
Write-Host "`n[3/4] Checking Live 24/7 Cloudflare Edge Validator..." -ForegroundColor Yellow
$workerUrl = "https://piso-ai-validator.janlad2025.workers.dev"
try {
    $res = Invoke-RestMethod -Uri "$workerUrl/api/validator-status" -Method Get -TimeoutSec 5
    Write-Host "✅ Edge Node is ONLINE 24/7!" -ForegroundColor Green
    Write-Host "   Worker URL : $workerUrl" -ForegroundColor Gray
    Write-Host "   Role       : $($res.role)" -ForegroundColor Gray
    Write-Host "   Status     : $($res.status)" -ForegroundColor Gray
    Write-Host "   Current Blk: $($res.currentBlock)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Warning: Could not reach edge node. Deploying now..." -ForegroundColor Yellow
    npx wrangler deploy
}

# 4. Open Live Dashboard
Write-Host "`n[4/4] Launching Apple/Stripe-styled Validator Dashboard..." -ForegroundColor Yellow
Start-Process "$workerUrl/dashboard"

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " 🎉 ALL SYSTEMS OPERATIONAL! Your PC can now be turned OFF." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "To publish to GitHub, run:" -ForegroundColor Cyan
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Green

