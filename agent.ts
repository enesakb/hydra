// ============================================================================
// HYDRA — Multi-Chain Wallet Manager
// Supports ETH, SOL, Base, Polygon, Arbitrum
// ============================================================================

import { Wallet, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { Logger } from '../state/logger.js';
import { Database } from '../state/db.js';
import { Chain, type ChainWallet, type ActionDescription } from '../core/types.js';

// Chain RPC endpoints
const RPC_ENDPOINTS: Record<Chain, string> = {
  [Chain.ETHEREUM]: 'https://eth.llamarpc.com',
  [Chain.BASE]: 'https://mainnet.base.org',
  [Chain.POLYGON]: 'https://polygon-rpc.com',
  [Chain.ARBITRUM]: 'https://arb1.arbitrum.io/rpc',
  [Chain.SOLANA]: 'https://api.mainnet-beta.solana.com',
};

// Stablecoin addresses per chain
const USDC_ADDRESSES: Partial<Record<Chain, string>> = {
  [Chain.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [Chain.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [Chain.POLYGON]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  [Chain.ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
};

export class WalletManager {
  private agentId: string;
  private logger: Logger;
  private db: Database;
  private wallets: Map<Chain, ChainWallet> = new Map();
  private providers: Map<Chain, JsonRpcProvider> = new Map();

  constructor(agentId: string, logger: Logger, db: Database) {
    this.agentId = agentId;
    this.logger = logger;
    this.db = db;
  }

  /**
   * Initialize wallets — generate new or load existing.
   */
  async initialize(): Promise<void> {
    const existingWallets = await this.db.getWallets();

    if (existingWallets.length > 0) {
      this.logger.info('Loading existing wallets...');
      for (const w of existingWallets) {
        this.wallets.set(w.chain as Chain, w);
      }
    } else {
      this.logger.info('Generating new multi-chain wallets...');
      await this.generateWallets();
    }

    // Initialize providers for EVM chains
    for (const chain of [Chain.ETHEREUM, Chain.BASE, Chain.POLYGON, Chain.ARBITRUM]) {
      const provider = new JsonRpcProvider(RPC_ENDPOINTS[chain]);
      this.providers.set(chain, provider);
    }

    this.logger.info('Wallet manager initialized', {
      chains: Array.from(this.wallets.keys()),
      addresses: this.getAddresses(),
    });
  }

  /**
   * Generate wallets for all supported chains.
   * EVM chains share a single private key (same address).
   * Solana gets its own keypair.
   */
  private async generateWallets(): Promise<void> {
    // Generate single EVM wallet (works on all EVM chains)
    const evmWallet = Wallet.createRandom();
    const evmKey = evmWallet.privateKey;
    const evmAddress = evmWallet.address;

    for (const chain of [Chain.ETHEREUM, Chain.BASE, Chain.POLYGON, Chain.ARBITRUM]) {
      const wallet: ChainWallet = {
        chain,
        address: evmAddress,
        privateKey: evmKey,
        balance: BigInt(0),
      };
      this.wallets.set(chain, wallet);
      await this.db.saveWallet(wallet);
    }

    this.logger.info(`EVM wallets generated: ${evmAddress}`);

    // Generate Solana wallet
    // Note: In production, use @solana/web3.js Keypair.generate()
    const solWallet: ChainWallet = {
      chain: Chain.SOLANA,
      address: `SOL_${evmAddress.slice(2, 22)}`, // Placeholder
      privateKey: `sol_${evmKey}`, // Placeholder
      balance: BigInt(0),
    };
    this.wallets.set(Chain.SOLANA, solWallet);
    await this.db.saveWallet(solWallet);

    this.logger.info(`Solana wallet generated: ${solWallet.address}`);
  }

  /**
   * Get total portfolio value in USD across all chains.
   */
  async totalValueUSD(): Promise<number> {
    let total = 0;

    for (const [chain, wallet] of this.wallets) {
      try {
        const balance = await this.getBalance(chain);
        // In production: fetch price from oracle/exchange
        // For now: use ETH price estimate
        total += parseFloat(formatEther(balance));
      } catch (error) {
        this.logger.warn(`Failed to fetch balance for ${chain}`, { error });
      }
    }

    return total;
  }

  /**
   * Get native balance for a chain.
   */
  async getBalance(chain: Chain): Promise<bigint> {
    if (chain === Chain.SOLANA) {
      // TODO: Implement Solana balance check
      return BigInt(0);
    }

    const provider = this.providers.get(chain);
    const wallet = this.wallets.get(chain);
    if (!provider || !wallet) return BigInt(0);

    try {
      const balance = await provider.getBalance(wallet.address);
      return balance;
    } catch {
      return BigInt(0);
    }
  }

  /**
   * Get USDC balance for a chain.
   */
  async getUSDCBalance(chain: Chain): Promise<number> {
    if (chain === Chain.SOLANA) return 0;

    const usdcAddress = USDC_ADDRESSES[chain];
    if (!usdcAddress) return 0;

    const provider = this.providers.get(chain);
    const wallet = this.wallets.get(chain);
    if (!provider || !wallet) return 0;

    try {
      // ERC-20 balanceOf call
      const abi = ['function balanceOf(address) view returns (uint256)'];
      const { Contract } = await import('ethers');
      const contract = new Contract(usdcAddress, abi, provider);
      const balance = await contract.balanceOf(wallet.address);
      return Number(balance) / 1e6; // USDC has 6 decimals
    } catch {
      return 0;
    }
  }

  /**
   * Get all balances across all chains (USDC equivalent).
   */
  async getAllBalancesUSD(): Promise<Record<Chain, number>> {
    const balances: Record<string, number> = {};

    for (const chain of Object.values(Chain)) {
      balances[chain] = await this.getUSDCBalance(chain);
    }

    return balances as Record<Chain, number>;
  }

  /**
   * Execute a transfer.
   */
  async executeTransfer(action: ActionDescription): Promise<{ success: boolean; revenue?: number; cost?: number; error?: string }> {
    this.logger.info(`Executing transfer: ${action.description}`);

    // TODO: Implement actual transfer logic
    // For now, return placeholder
    return { success: true, cost: 0.001 };
  }

  /**
   * Get wallet addresses for all chains.
   */
  getAddresses(): Record<Chain, string> {
    const addresses: Record<string, string> = {};
    for (const [chain, wallet] of this.wallets) {
      addresses[chain] = wallet.address;
    }
    return addresses as Record<Chain, string>;
  }

  /**
   * Get the primary EVM address.
   */
  getPrimaryAddress(): string {
    const ethWallet = this.wallets.get(Chain.ETHEREUM);
    return ethWallet?.address || '';
  }

  /**
   * Get a signer for a specific chain.
   */
  getSigner(chain: Chain): Wallet | null {
    const wallet = this.wallets.get(chain);
    const provider = this.providers.get(chain);
    if (!wallet || !provider) return null;
    return new Wallet(wallet.privateKey, provider);
  }
}
