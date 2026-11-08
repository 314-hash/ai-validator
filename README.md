# PISO Chain Autonomous AI Validator & Layer 3 Micro-Clearing Engine

> **$0 Budget 24/7 Serverless Web3 Stack**  
> Run an autonomous PISO Chain validator node and AI micro-escrow clearing agent on Cloudflare Edge without keeping your local PC on.

---

## 🏗️ Architecture & Security Model

```
   [ User / Cold Wallet ]
             │
             │ (1) Stakes PISO tokens
             │ (2) Registers scoped Cloud Session Key (NO withdrawal permissions)
             ▼
[ PisoAIValidatorRegistry.sol ] ◄── (4) Auto-releases milestone once 3/3 quorum reached
             ▲
             │ (3) submitAIValidation(escrowId, approved, signature)
             │
┌────────────┴────────────────────────────────────────────────────────┐
│ Cloudflare Workers (Free Tier - 24/7 "PC-OFF" Cloud Edge)           │
│                                                                     │
│  • worker.ts (Hono + Viem)                                          │
│  • Workers AI: @cf/meta/llama-3.1-8b-instruct (Free 10k reqs/day)  │
│  • Cloudflare Cron Triggers: */5 * * * * (Every 5 minutes)          │
│  • KV Namespace: Micro-clearing state & log caching                 │
│  • ERC-4337 Verifying Paymaster: Zero-gas sponsored transactions    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 1-Click Deployment Guide ($0 Total Cost)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Free Cloudflare KV Namespace
```bash
npx wrangler kv:namespace create PISO_KV
```
Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.

### Step 3: Configure Cloudflare Secrets
Store the validator burner session key and optional paymaster key in Cloudflare's encrypted vault:
```bash
npx wrangler secret put VALIDATOR_SESSION_PRIVATE_KEY
# Enter your generated 0x... private key (scoped session key, NOT your cold wallet)

npx wrangler secret put PAYMASTER_PRIVATE_KEY
# Optional: Private key of the verifying paymaster sponsor wallet
```

### Step 4: Deploy Cloudflare Worker to Global Edge
```bash
npx wrangler deploy
```

Once deployed, your Cloudflare Worker URL will be active (e.g., `https://piso-ai-validator.<your-subdomain>.workers.dev`).

## 🌐 Vercel Subdomain Integration

If you deploy your frontend or custom subdomain to Vercel (e.g. `https://your-subdomain.vercel.app`):
1. [`vercel.json`](./vercel.json) is pre-configured with reverse-proxy rewrites pointing `/api/validator/*` directly to `https://piso-ai-validator.janlad2025.workers.dev/api/*`.
2. Visiting `/validator` on your Vercel subdomain will load the complete [`pisochain-validator-dashboard.html`](./pisochain-validator-dashboard.html).
3. Set these environment variables in your Vercel Project Settings:
   - `NEXT_PUBLIC_VALIDATOR_ENDPOINT=https://piso-ai-validator.janlad2025.workers.dev`
   - `NEXT_PUBLIC_RPC_URL=https://202555.rpcscan.xyz`
   - `NEXT_PUBLIC_CHAIN_ID=2026001`

---

## 🛡️ Security Guarantees: Why Seed Phrases are Never Exposed

1. **Cold Wallet Staking**: Community members stake PISO tokens directly from their MetaMask/Rabby/Ledger cold wallet into `PisoAIValidatorRegistry.sol`.
2. **Zero-Withdrawal Scoped Session Key**:
   - The session key on Cloudflare Workers can **only** call `submitAIValidation()`.
   - The contract contains **no withdrawal logic** executable by the session key.
   - If the Cloudflare Worker were ever breached, the attacker gains **zero access** to your staked PISO tokens.
3. **Emergency Revocation**: The cold wallet owner can invoke `revokeSessionKey()` or `unstake()` on-chain at any time to immediately deactivate the cloud key.

---

## 🧪 Testing the Modules

- **Validator Health Check**:
  ```bash
  curl https://piso-ai-validator.workers.dev/api/validator-status
  ```
- **Taglish AI Agent Parsing & Zero-Gas Sponsorship**:
  ```bash
  curl -X POST https://piso-ai-validator.workers.dev/api/agent-command \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Boss paki-lock ng 500 PISO escrow kay juan.eth para sa logo design"}'
  ```
- **Validator Dashboard**:
  Open [pisochain-validator-dashboard.html](file:///c:/Users/janla/serverless/pisochain-validator-dashboard.html) in any browser to inspect live micro-clearing activity.

