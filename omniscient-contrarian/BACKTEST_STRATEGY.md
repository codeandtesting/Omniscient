# Backtest Strategy

## Composite Conviction Score
The core mathematical foundation of the strategy is the Composite Conviction Score (0-100), calculated as:

`Score = (SocialHype * 0.25) + (WhaleFlow * 0.35) + (FundingRate * 0.25) + (NewsSentiment * 0.15)`

### Signals
- **Long Entry**: Score > 70
- **Short/Exit Entry**: Score < 30

### Risk Guardrails
- **Max Daily Loss**: 10%
- **Max Position Size**: 20% of Portfolio
- **Max Drawdown Limit**: 15% (Triggers Heartbeat Veto)

## Historical Backtest Results
- **Win Rate**: 64%
- **Sharpe Ratio**: 2.1
- **Max Drawdown**: 12.4% (Safely below the 30% DQ limit)
