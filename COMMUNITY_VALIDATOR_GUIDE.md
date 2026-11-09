# PISO Chain Community AI Validator Node Guide ($0 Budget)

> **Join the decentralized PISO Chain Layer 3 micro-clearing network.**  
> Earn validation fees and secure freelance/P2P escrows 24/7 on Cloudflare's free edge tier without keeping your computer turned on.

---

## ⚡ 3-Minute Quick Start

### 1. Prerequisites
- A free [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- Node.js v18+ installed on your PC
- PISO tokens in your cold wallet (MetaMask, Rabby, etc.)

---

### 2. Fork & Clone
```bash
git clone https://github.com/314-hash/ai-validator.git
cd ai-validator
npm install
```

---

### 3. Generate Your Scoped Session Key
Run the burner key generator:
```bash
npm run generate:key
```
You will receive:
* **`SESSION_PRIVATE_KEY`**: Set this as a secret in your Cloudflare account.
* **`SESSION_PUBLIC_ADDRESS`**: The address you will authorize from your cold wallet.

> 🔒 **Security Guarantee**: This session key has **0 token withdrawal permissions**. It can only sign deliverable verification verdicts. Your staked funds remain 100% safe in your cold wallet.

---

### 4. Deploy to Your Cloudflare Account
```bash
# 1. Create your free KV storage
npx wrangler kv namespace create PISO_KV
# (Paste the generated ID into wrangler.toml)

# 2. Store your session private key securely
npx wrangler secret put VALIDATOR_SESSION_PRIVATE_KEY

# 3. Deploy 24/7 edge worker
npx wrangler deploy
```

---

### 5. Stake PISO Tokens
1. Open the [PISO Chain Validator Dashboard](https://piso-ai-validator.janlad2025.workers.dev/dashboard).
2. Connect your Cold Wallet.
3. Enter your `SESSION_PUBLIC_ADDRESS` and stake `1,000 PISO`.
4. Confirm on-chain.

**You can now turn your PC completely OFF.** Your Cloudflare worker will wake up every 5 minutes in the cloud, evaluate completed tasks using Meta Llama 3.1 8B, and release milestones automatically.

