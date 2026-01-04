
import React from 'react';
import { AlertTriangle } from 'lucide-react';

const BudgetGauge = ({ spent, budget, height = "h-2" }) => {
    const safeBudget = budget || 0;
    const safeSpent = spent || 0;

    // Calculate percentage for display text
    const percentage = safeBudget > 0 ? (safeSpent / safeBudget) * 100 : 0;

    const isOverBudget = safeSpent > safeBudget;

    return (
        <div className="w-full">
            {/* Gauge Container */}
            <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${height}`}>
                {!isOverBudget ? (
                    // Under Budget: Simple green bar
                    <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                ) : (
                    // Over Budget: Split bar (Green for budgeted amount, Red for excess)
                    <div className="flex h-full w-full">
                        {/* The part that was budgeted (Green) */}
                        <div
                            className="h-full bg-green-500"
                            style={{ width: `${(safeBudget / safeSpent) * 100}%` }}
                        />
                        {/* The part that exceeded (Red) */}
                        <div
                            className="h-full bg-red-500"
                            style={{ width: `${((safeSpent - safeBudget) / safeSpent) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Percentage Text */}
            <div className="flex justify-between text-xs mt-1">
                <span className={`font-medium ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                    {percentage.toFixed(1)}% do total orçado
                </span>
                {isOverBudget && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-red-500" />}
            </div>
        </div>
    );
};

export default BudgetGauge;
