import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

/**
 * PISO Chain Session Key Generator
 * Generates an isolated burner key pair for Cloudflare Workers.
 * Staked tokens CANNOT be transferred or withdrawn by this key.
 */
function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log('================================================================');
  console.log(' PISO CHAIN SCOPED CLOUD SESSION KEY GENERATOR                  ');
  console.log('================================================================\n');

  console.log('1. CLOUDFLARE ENCRYPTED SECRET (Set this in Cloudflare vault):');
  console.log(`   VALIDATOR_SESSION_PRIVATE_KEY: ${privateKey}\n`);

  console.log('2. PUBLIC ADDRESS (Authorize this address from your Cold Wallet):');
  console.log(`   SESSION_PUBLIC_ADDRESS:        ${account.address}\n`);

  console.log('----------------------------------------------------------------');
  console.log('NEXT COMMANDS TO RUN:');
  console.log('----------------------------------------------------------------');
  console.log('1. Push key to Cloudflare:');
  console.log(`   npx wrangler secret put VALIDATOR_SESSION_PRIVATE_KEY`);
  console.log('   (Paste the private key above when prompted)\n');

  console.log('2. In pisochain-validator-dashboard.html or via contract call:');
  console.log(`   Call: registerValidator("${account.address}", 1000000000000000000000, 1800000000)`);
  console.log('================================================================');
}

main();

