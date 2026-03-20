/**
 * CostOverview — summary cards for total spend, total budget, utilization %.
 * Inspired by Paperclip's BudgetPolicyCard layout.
 */

import { MetricCard } from "./MetricCard.jsx";
import { DollarSign, Wallet, TrendingUp } from "lucide-react";

export function CostOverview({ totals, onClick }) {
  const { spend = 0, budget = 0, utilizationPct = 0 } = totals || {};

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
      <MetricCard
        icon={DollarSign}
        label="Total Spend"
        value={`$${spend.toFixed(2)}`}
        mono
        onClick={onClick}
      />
      <MetricCard
        icon={Wallet}
        label="Total Budget"
        value={budget > 0 ? `$${budget}/wk` : "No cap"}
        mono
        onClick={onClick}
      />
      <MetricCard
        icon={TrendingUp}
        label="Utilization"
        value={budget > 0 ? `${utilizationPct}%` : "--"}
        description={
          utilizationPct > 95
            ? "Budget nearly exhausted"
            : utilizationPct > 80
              ? "Approaching budget limit"
              : utilizationPct > 60
                ? "On track"
                : "Under budget"
        }
        onClick={onClick}
      />
      <MetricCard
        label="Remaining"
        value={budget > 0 ? `$${Math.max(0, budget - spend).toFixed(2)}` : "--"}
        mono
        onClick={onClick}
      />
    </div>
  );
}
