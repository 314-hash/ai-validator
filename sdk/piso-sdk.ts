import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  defineChain, 
  keccak256, 
  toHex, 
  parseAbi,
  parseEther,
  formatEther
} from 'viem';

export const PISO_CHAIN_CONFIG = {
  chainId: 2026001,
  name: 'PISO Chain L3 Micro-Clearing',
  rpcUrl: 'https://202555.rpcscan.xyz',
  explorerUrl: 'https://pisochain.com/explorer',
  defaultWorkerEndpoint: 'https://piso-ai-validator.janlad2025.workers.dev'
};

const pisoChain = defineChain({
  id: PISO_CHAIN_CONFIG.chainId,
  name: PISO_CHAIN_CONFIG.name,
  nativeCurrency: { name: 'PISO', symbol: 'PISO', decimals: 18 },
  rpcUrls: {
    default: { http: [PISO_CHAIN_CONFIG.rpcUrl] },
    public: { http: [PISO_CHAIN_CONFIG.rpcUrl] }
  }
});

export const REGISTRY_ABI = parseAbi([
  'function createEscrow(bytes32 escrowId, address seller, address token, uint256 amount, string calldata criteriaUri, uint256 requiredQuorum, uint256 deadline) external payable',
  'function submitDeliverable(bytes32 escrowId, string calldata deliverableUri) external',
  'function submitAIValidation(bytes32 escrowId, bool approved, bytes calldata proofSignature) external',
  'function getEscrow(bytes32 escrowId) external view returns ((bytes32 escrowId, address buyer, address seller, address token, uint256 amount, string criteriaUri, string deliverableUri, uint8 status, uint256 approvalVotes, uint256 rejectionVotes, uint256 requiredQuorum, uint256 createdAt, uint256 deadline))',
  'function isValidatorActive(address sessionKey) external view returns (bool)'
]);

export interface EscrowCreationParams {
  seller: `0x${string}`;
  amount: string; // in PISO
  criteria: string;
  tokenAddress?: `0x${string}`;
  requiredQuorum?: number;
  deadlineHours?: number;
}

export class PisoClient {
  private workerUrl: string;
  private registryAddress: `0x${string}`;
  public publicClient;

  constructor(options?: { workerUrl?: string; registryAddress?: `0x${string}`; rpcUrl?: string }) {
    this.workerUrl = options?.workerUrl || PISO_CHAIN_CONFIG.defaultWorkerEndpoint;
    this.registryAddress = options?.registryAddress || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    this.publicClient = createPublicClient({
      chain: pisoChain,
      transport: http(options?.rpcUrl || PISO_CHAIN_CONFIG.rpcUrl)
    });
  }

  /**
   * Generates a deterministic escrow ID.
   */
  public generateEscrowId(buyerAddress: string): `0x${string}` {
    return keccak256(toHex(`piso-escrow-${buyerAddress}-${Date.now()}-${Math.random()}`));
  }

  /**
   * Parses natural language Taglish/English commands via the Cloud AI Edge Agent.
   */
  public async parseAgentCommand(prompt: string, userAddress?: string) {
    const res = await fetch(`${this.workerUrl}/api/agent-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, userAddress })
    });
    if (!res.ok) throw new Error(`Agent command failed: HTTP ${res.status}`);
    return await res.json();
  }

  /**
   * Fetches real-time status of an escrow on PISO Chain.
   */
  public async getEscrowDetails(escrowId: `0x${string}`) {
    const data: any = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'getEscrow',
      args: [escrowId]
    });

    const statusLabels = ['Inactive', 'Funded', 'DeliverableSubmitted', 'Released', 'Refunded'];
    return {
      escrowId: data.escrowId,
      buyer: data.buyer,
      seller: data.seller,
      amount: formatEther(data.amount),
      criteriaUri: data.criteriaUri,
      deliverableUri: data.deliverableUri,
      status: statusLabels[data.status] || 'Unknown',
      approvalVotes: Number(data.approvalVotes),
      rejectionVotes: Number(data.rejectionVotes),
      requiredQuorum: Number(data.requiredQuorum),
      deadline: new Date(Number(data.deadline) * 1000).toISOString()
    };
  }

  /**
   * Checks whether the 24/7 Cloud AI Validator is active.
   */
  public async getValidatorNodeStatus() {
    const res = await fetch(`${this.workerUrl}/api/validator-status`);
    if (!res.ok) throw new Error(`Validator status check failed: HTTP ${res.status}`);
    return await res.json();
  }
}
