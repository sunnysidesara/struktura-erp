<?php

namespace Tests\Unit;

use App\Support\ProjectBudget;
use PHPUnit\Framework\TestCase;

class ProjectBudgetTest extends TestCase
{
    public function test_it_summarizes_budget_and_recorded_costs(): void
    {
        $summary = ProjectBudget::summarize(2_400_000.00, 1_230_517.50, 1_168_482.50);

        $this->assertEqualsWithDelta(1_169_482.50, $summary['spent_budget'], 0.001);
        $this->assertSame(49, $summary['utilization']);
        $this->assertEqualsWithDelta(1_168_482.50, $summary['recorded_costs'], 0.001);
    }

    public function test_it_handles_zero_and_overdrawn_budgets(): void
    {
        $zero = ProjectBudget::summarize(0.0, 0.0, 99.99);

        $this->assertSame(0.0, $zero['spent_budget']);
        $this->assertSame(0, $zero['utilization']);
        $this->assertEqualsWithDelta(99.99, $zero['recorded_costs'], 0.001);

        $overdrawn = ProjectBudget::summarize(1_000.00, -250.00, 1_250.00);

        $this->assertEqualsWithDelta(1_250.00, $overdrawn['spent_budget'], 0.001);
        $this->assertSame(125, $overdrawn['utilization']);
        $this->assertEqualsWithDelta(1_250.00, $overdrawn['recorded_costs'], 0.001);
    }

    public function test_it_keeps_integer_utilization_for_partial_spend(): void
    {
        $summary = ProjectBudget::summarize(3_100_000.00, 1_865_997.50, 1_234_002.50);

        $this->assertEqualsWithDelta(1_234_002.50, $summary['spent_budget'], 0.001);
        $this->assertSame(40, $summary['utilization']);
    }
}
