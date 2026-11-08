import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * PISO Chain - Micro-Clearing Escrow Seeder
 * Injects sample deliverables into Cloudflare KV state so your 24/7 Edge Worker
 * can test autonomous AI verification and milestone clearing.
 */
async function seedEscrow() {
  const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';
  console.log(`[PISO SEEDER] Target Node: ${workerUrl}`);

  const sampleEscrowId = keccak256(toHex(`escrow-${Date.now()}`));

  const payload = {
    escrowId: sampleEscrowId,
    buyer: '0x1111111111111111111111111111111111111111',
    seller: '0x2222222222222222222222222222222222222222',
    amount: '500',
    criteria: 'Build responsive landing page with Tailwind CSS, clean light mode theme, and Filipino/English localization.',
    deliverableUri: 'https://github.com/314-hash/piso-chain/pull/42',
    status: 2 // DeliverableSubmitted
  };

  console.log('Generated Micro-Clearing Escrow:');
  console.log(JSON.stringify(payload, null, 2));

  console.log('\n✅ To queue this escrow in Cloudflare KV for the next 5-minute cron check:');
  console.log(`npx wrangler kv:key put --namespace-id=PISO_KV "pending:escrow:${sampleEscrowId}" '${JSON.stringify(payload)}'`);
}

seedEscrow().catch(console.error);

