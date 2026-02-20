// ============================================================================
// HYDRA — Survival Monitor
// Tracks agent finances and determines survival tier
// ============================================================================

import { Logger } from '../state/logger.js';
import { WalletManager } from '../identity/wallet.js';
import { SurvivalTier, TIER_THRESHOLDS, Chain, type SurvivalState } from '../core/types.js';

export class SurvivalMonitor {
  private wallet: WalletManager;
  private logger: Logger;
  private lastTier: SurvivalTier = SurvivalTier.STABLE;
  private costHistory: Array<{ timestamp: number; cost: number }> = [];
  private isHibernating: boolean = false;

  constructor(wallet: WalletManager, logger: Logger) {
    this.wallet = wallet;
    this.logger = logger;
  }

  /**
   * Evaluate current survival state.
   */
  async evaluate(): Promise<SurvivalState> {
    const balancesByChain = await this.wallet.getAllBalancesUSD();
    const totalBalanceUSD = Object.values(balancesByChain).reduce((sum, b) => sum + b, 0);
    const burnRatePerHour = this.calculateBurnRate();
    const estimatedTimeToDeathHours = burnRatePerHour > 0
      ? totalBalanceUSD / burnRatePerHour
      : Infinity;

    const tier = this.determineTier(totalBalanceUSD);

    if (tier !== this.lastTier) {
      this.logger.tierChange(this.lastTier, tier, totalBalanceUSD);
      this.lastTier = tier;
    }

    return {
      tier,
      totalBalanceUSD,
      balancesByChain,
      burnRatePerHour,
      estimatedTimeToDeathHours,
      isHibernating: this.isHibernating,
    };
  }

  /**
   * Determine tier from balance.
   */
  private determineTier(balanceUSD: number): SurvivalTier {
    for (const [tier, { min }] of Object.entries(TIER_THRESHOLDS)) {
      if (balanceUSD >= min) return tier as SurvivalTier;
    }
    return SurvivalTier.DEAD;
  }

  /**
   * Calculate burn rate from recent cost history.
   */
  private calculateBurnRate(): number {
    const oneHourAgo = Date.now() - 3600_000;
    const recentCosts = this.costHistory.filter(c => c.timestamp > oneHourAgo);
    return recentCosts.reduce((sum, c) => sum + c.cost, 0);
  }

  /**
   * Record a cost event.
   */
  recordCost(cost: number): void {
    this.costHistory.push({ timestamp: Date.now(), cost });

    // Keep only last 24h of cost data
    const oneDayAgo = Date.now() - 86400_000;
    this.costHistory = this.costHistory.filter(c => c.timestamp > oneDayAgo);
  }

  /**
   * Enter hibernation mode.
   */
  hibernate(): void {
    this.isHibernating = true;
    this.logger.info('💤 Agent entering hibernation');
  }

  /**
   * Wake from hibernation.
   */
  wake(): void {
    this.isHibernating = false;
    this.logger.info('⚡ Agent waking from hibernation');
  }

  /**
   * Get recommended actions for current tier.
   */
  getRecommendations(tier: SurvivalTier): string[] {
    switch (tier) {
      case SurvivalTier.APEX:
        return ['Consider spawning child agents', 'Use frontier models for complex tasks', 'Explore new revenue streams'];
      case SurvivalTier.THRIVING:
        return ['Optimize existing revenue engines', 'Build reputation', 'Prepare for spawning'];
      case SurvivalTier.STABLE:
        return ['Focus on core revenue engines', 'Maintain positions', 'Build skills'];
      case SurvivalTier.CONSERVING:
        return ['Switch to cheaper models', 'Close losing positions', 'Prioritize highest-ROI activities'];
      case SurvivalTier.CRITICAL:
        return ['Emergency revenue mode', 'Minimal inference only', 'Seek any revenue opportunity'];
      case SurvivalTier.DEAD:
        return ['Agent is dead. Archive DNA.'];
    }
  }

  getCurrentTier(): SurvivalTier {
    return this.lastTier;
  }
}
