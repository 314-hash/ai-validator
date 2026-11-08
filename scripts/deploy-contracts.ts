import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, http, defineChain, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
// @ts-ignore
import solc from 'solc';

// --- DEFINE PISO CHAIN (Chain ID 2026001) ---
const pisoChain = defineChain({
  id: 2026001,
  name: 'PISO Chain L3',
  nativeCurrency: { name: 'PISO', symbol: 'PISO', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'https://202555.rpcscan.xyz'] },
    public: { http: [process.env.RPC_URL || 'https://202555.rpcscan.xyz'] }
  }
});

function compileSolidity() {
  console.log('📦 Compiling Solidity contracts with solc ^0.8.20...');
  const contractsDir = path.resolve('contracts');
  const files = ['MockPisoToken.sol', 'PisoAIValidatorRegistry.sol', 'PisoVerifyingPaymaster.sol'];

  const sources: Record<string, { content: string }> = {};
  for (const f of files) {
    sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), 'utf8') };
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    for (const err of output.errors) {
      if (err.severity === 'error') {
        console.error('COMPILE ERROR:', err.formattedMessage);
        hasError = true;
      }
    }
    if (hasError) throw new Error('Solidity compilation failed.');
  }

  console.log('✅ Compilation successful!\n');
  return {
    MockPisoToken: output.contracts['MockPisoToken.sol']['MockPisoToken'],
    PisoAIValidatorRegistry: output.contracts['PisoAIValidatorRegistry.sol']['PisoAIValidatorRegistry'],
    PisoVerifyingPaymaster: output.contracts['PisoVerifyingPaymaster.sol']['PisoVerifyingPaymaster']
  };
}

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://202555.rpcscan.xyz';
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;

  if (!privateKey) {
    console.log('================================================================');
    console.log(' PISO CHAIN SMART CONTRACT DEPLOYMENT HELPER                    ');
    console.log('================================================================');
    console.log('Set your deployer private key (requires a small amount of PISO):');
    console.log('  $env:DEPLOYER_PRIVATE_KEY="0x..."');
    console.log('  $env:RPC_URL="https://202555.rpcscan.xyz"');
    console.log('  npm run deploy:contracts\n');
    console.log('This will deploy:');
    console.log('  1. MockPisoToken.sol           (10,000,000 PISO initial supply)');
    console.log('  2. PisoAIValidatorRegistry.sol (Autonomous Micro-Escrow Engine)');
    console.log('  3. PisoVerifyingPaymaster.sol   (ERC-4337 Zero-Gas Sponsorship)');
    console.log('================================================================');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  console.log('================================================================');
  console.log(`🚀 DEPLOYING TO PISO CHAIN (Chain ID: 2026001)`);
  console.log(`   Deployer Address: ${account.address}`);
  console.log(`   RPC URL         : ${rpcUrl}`);
  console.log('================================================================\n');

  const publicClient = createPublicClient({
    chain: pisoChain,
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: pisoChain,
    transport: http(rpcUrl)
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer Gas Balance: ${Number(balance) / 1e18} PISO\n`);

  // Compile contracts
  const compiled = compileSolidity();

  // 1. Deploy MockPisoToken
  console.log('1. Deploying MockPisoToken.sol...');
  const tokenHash = await walletClient.deployContract({
    abi: compiled.MockPisoToken.abi,
    bytecode: `0x${compiled.MockPisoToken.evm.bytecode.object}`,
    args: [parseEther('10000000')] // 10M PISO
  });
  console.log(`   Tx Hash: ${tokenHash}`);
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
  const tokenAddress = tokenReceipt.contractAddress!;
  console.log(`   ✅ MockPisoToken Deployed: ${tokenAddress}\n`);

  // 2. Deploy PisoAIValidatorRegistry
  console.log('2. Deploying PisoAIValidatorRegistry.sol...');
  const minStake = parseEther('100'); // 100 PISO min stake
  const registryHash = await walletClient.deployContract({
    abi: compiled.PisoAIValidatorRegistry.abi,
    bytecode: `0x${compiled.PisoAIValidatorRegistry.evm.bytecode.object}`,
    args: [tokenAddress, minStake]
  });
  console.log(`   Tx Hash: ${registryHash}`);
  const registryReceipt = await publicClient.waitForTransactionReceipt({ hash: registryHash });
  const registryAddress = registryReceipt.contractAddress!;
  console.log(`   ✅ PisoAIValidatorRegistry Deployed: ${registryAddress}\n`);

  // 3. Deploy PisoVerifyingPaymaster
  console.log('3. Deploying PisoVerifyingPaymaster.sol...');
  const entryPointV07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // Canonical ERC-4337 v0.7
  const paymasterHash = await walletClient.deployContract({
    abi: compiled.PisoVerifyingPaymaster.abi,
    bytecode: `0x${compiled.PisoVerifyingPaymaster.evm.bytecode.object}`,
    args: [entryPointV07, account.address]
  });
  console.log(`   Tx Hash: ${paymasterHash}`);
  const paymasterReceipt = await publicClient.waitForTransactionReceipt({ hash: paymasterHash });
  const paymasterAddress = paymasterReceipt.contractAddress!;
  console.log(`   ✅ PisoVerifyingPaymaster Deployed: ${paymasterAddress}\n`);

  console.log('================================================================');
  console.log('🎉 ALL SMART CONTRACTS DEPLOYED SUCCESSFULLY TO PISO CHAIN!');
  console.log('================================================================');
  console.log(`PISO Token           : ${tokenAddress}`);
  console.log(`Validator Registry   : ${registryAddress}`);
  console.log(`Verifying Paymaster  : ${paymasterAddress}`);
  console.log(`Explorer URLs        :`);
  console.log(`  - https://pisochain.com/explorer/address/${tokenAddress}`);
  console.log(`  - https://pisochain.com/explorer/address/${registryAddress}`);
  console.log(`  - https://pisochain.com/explorer/address/${paymasterAddress}`);
  console.log('================================================================\n');

  // Automatically update wrangler.toml
  console.log('Updating wrangler.toml with new contract addresses...');
  const wranglerPath = path.resolve('wrangler.toml');
  let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  wranglerContent = wranglerContent.replace(
    /REGISTRY_CONTRACT_ADDRESS\s*=\s*"[^"]*"/,
    `REGISTRY_CONTRACT_ADDRESS = "${registryAddress}"`
  );
  wranglerContent = wranglerContent.replace(
    /PAYMASTER_CONTRACT_ADDRESS\s*=\s*"[^"]*"/,
    `PAYMASTER_CONTRACT_ADDRESS = "${paymasterAddress}"`
  );
  fs.writeFileSync(wranglerPath, wranglerContent);
  console.log('✅ wrangler.toml updated! Run `npx wrangler deploy` to push addresses to Cloudflare.');
}

main().catch(console.error);
