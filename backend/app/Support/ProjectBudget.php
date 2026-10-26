<?php

namespace App\Support;

/**
 * Budget summary for the Admin project table.
 *
 * "Spent" follows PM Finance (approved minus remaining) so both consoles
 * reconcile. Recorded costs are the sum of the three usage streams and are
 * returned alongside it for diagnostics.
 */
final class ProjectBudget
{
    /**
     * @return array{spent_budget: float, utilization: int, recorded_costs: float}
     */
    public static function summarize(float $approved, float $remaining, float $recordedCosts): array
    {
        $approved = max(0.0, round($approved, 2));
        $remaining = round($remaining, 2);
        $spent = max(0.0, round($approved - $remaining, 2));

        return [
            'spent_budget' => $spent,
            'utilization' => $approved > 0 ? (int) round(($spent / $approved) * 100) : 0,
            'recorded_costs' => round(max(0.0, $recordedCosts), 2),
        ];
    }
}
