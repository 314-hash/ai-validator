import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';

export function compileContracts() {
  console.log('Compiling Solidity contracts with solc ^0.8.20...');
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
      } else {
        console.warn('COMPILE WARNING:', err.formattedMessage);
      }
    }
    if (hasError) throw new Error('Contract compilation failed.');
  }

  console.log('✅ All contracts compiled successfully!');
  return {
    MockPisoToken: output.contracts['MockPisoToken.sol']['MockPisoToken'],
    PisoAIValidatorRegistry: output.contracts['PisoAIValidatorRegistry.sol']['PisoAIValidatorRegistry'],
    PisoVerifyingPaymaster: output.contracts['PisoVerifyingPaymaster.sol']['PisoVerifyingPaymaster']
  };
}

if (process.argv[1]?.endsWith('compile.ts') || process.argv[1]?.endsWith('compile.js')) {
  compileContracts();
}

