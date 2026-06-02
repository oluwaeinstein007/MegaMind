export interface CalculationResult {
  expression: string;
  result: number | string;
  type: 'numeric' | 'date' | 'duration' | 'currency';
  unit?: string;
  breakdown?: Record<string, any>;
}

export class CalculateTool {
  private safeEval(expression: string): number {
    // Only allow safe mathematical operations
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    try {
      // Use Function constructor for safer evaluation than eval
      return new Function(`"use strict"; return (${sanitized})`)();
    } catch (error) {
      throw new Error(`Invalid calculation: ${expression}`);
    }
  }

  calculate(expression: string, type: 'numeric' | 'date' | 'duration' | 'currency' = 'numeric'): CalculationResult {
    try {
      switch (type) {
        case 'numeric':
          return this.calculateNumeric(expression);
        case 'date':
          return this.calculateDate(expression);
        case 'duration':
          return this.calculateDuration(expression);
        case 'currency':
          return this.calculateCurrency(expression);
        default:
          throw new Error(`Unsupported calculation type: ${type}`);
      }
    } catch (error) {
      console.warn(`[CalculateTool] Calculation failed for expression "${expression}" (${type}): ${error instanceof Error ? error.message : String(error)}`);
      return {
        expression,
        result: 'Error',
        type,
        breakdown: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private calculateNumeric(expression: string): CalculationResult {
    const result = this.safeEval(expression);
    return {
      expression,
      result: Math.round(result * 100) / 100, // Round to 2 decimal places
      type: 'numeric'
    };
  }

  private calculateDate(expression: string): CalculationResult {
    // Handle date calculations like "days between 2024-01-01 and 2024-01-10"
    const datePattern = /(\d{4}-\d{2}-\d{2})/g;
    const dates = expression.match(datePattern);
    
    if (dates && dates.length >= 2) {
      const start = new Date(dates[0]);
      const end = new Date(dates[1]);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        expression,
        result: diffDays,
        type: 'date',
        unit: 'days',
        breakdown: {
          startDate: dates[0],
          endDate: dates[1],
          days: diffDays
        }
      };
    }

    // Handle date arithmetic: e.g. "2026-06-10 + 7 days" or "2026-06-10 - 3 days"
    if (dates && dates.length === 1) {
      const baseDate = new Date(dates[0]);
      const daysMatch = expression.match(/([+-])\s*(\d+)\s*days?/i);
      
      if (daysMatch) {
        const sign = daysMatch[1] === '-' ? -1 : 1;
        const days = parseInt(daysMatch[2]) * sign;
        const resultDate = new Date(baseDate);
        resultDate.setDate(resultDate.getDate() + days);
        const resultStr = resultDate.toISOString().split('T')[0];

        return {
          expression,
          result: resultStr,
          type: 'date',
          unit: 'date',
          breakdown: {
            baseDate: dates[0],
            operation: daysMatch[1],
            days: Math.abs(days),
            resultDate: resultStr
          }
        };
      }
    }

    throw new Error('Could not parse date calculation. Use "YYYY-MM-DD to YYYY-MM-DD" for duration, or "YYYY-MM-DD + X days" for arithmetic.');
  }

  private calculateDuration(expression: string): CalculationResult {
    // Handle duration calculations like "3 hours + 45 minutes"
    const hours = this.extractNumber(expression, /(\d+)\s*hours?/i) || 0;
    const minutes = this.extractNumber(expression, /(\d+)\s*minutes?/i) || 0;
    
    const totalMinutes = hours * 60 + minutes;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return {
      expression,
      result: `${totalHours}h ${remainingMinutes}m`,
      type: 'duration',
      unit: 'time',
      breakdown: {
        totalMinutes,
        hours: totalHours,
        minutes: remainingMinutes
      }
    };
  }

  private calculateCurrency(expression: string): CalculationResult {
    // Handle currency calculations like "$150 * 7 days"
    const amountMatch = expression.match(/\$?(\d+(?:\.\d{2})?)/);
    const multiplierMatch = expression.match(/\*\s*(\d+)/);
    
    if (!amountMatch) {
      throw new Error('No currency amount found');
    }

    const amount = parseFloat(amountMatch[1]);
    const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;
    const total = amount * multiplier;

    return {
      expression,
      result: total,
      type: 'currency',
      unit: 'USD',
      breakdown: {
        baseAmount: amount,
        multiplier,
        total: Math.round(total * 100) / 100
      }
    };
  }

  private extractNumber(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : null;
  }

  // Specialized calculations for travel planning
  calculateTravelBudget(
    dailyBudget: number,
    days: number,
    categories: Record<string, number>
  ): CalculationResult {
    const total = dailyBudget * days;
    const breakdown: Record<string, any> = {};
    
    for (const [category, percentage] of Object.entries(categories)) {
      breakdown[category] = {
        daily: Math.round(dailyBudget * percentage * 100) / 100,
        total: Math.round(total * percentage * 100) / 100,
        percentage: Math.round(percentage * 100)
      };
    }

    return {
      expression: `${dailyBudget} * ${days} days`,
      result: total,
      type: 'currency',
      unit: 'USD',
      breakdown: {
        dailyBudget,
        days,
        total,
        categories: breakdown
      }
    };
  }

  calculateTravelTime(
    distance: number,
    speed: number,
    unit: 'km' | 'miles' = 'km'
  ): CalculationResult {
    const time = distance / speed;
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);

    return {
      expression: `${distance} ${unit} / ${speed} ${unit}/h`,
      result: `${hours}h ${minutes}m`,
      type: 'duration',
      unit: 'time',
      breakdown: {
        distance,
        speed,
        timeInHours: Math.round(time * 100) / 100,
        hours,
        minutes
      }
    };
  }
}