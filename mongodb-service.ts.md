```ts
// mongodb-service.ts - Service layer with Zod types
import { Payment, MeterDailyEnergyConsumption } from './schemas';
import { 
  GetMeterPaymentRequest, 
  GetMonthlyPaymentRequest,
  GetYearlyPaymentRequest,
  MeterPaymentResponse,
  MonthlyPaymentResponse,
  DailyConsumptionResponse,
  DailyConsumptionItem,
  YearlyPaymentResponse
} from './types';

export class MongoDBService {
  
  /**
   * Retrieve total payment for a given meter for a given period
   */
  async getTotalPaymentForMeter(
    request: GetMeterPaymentRequest
  ): Promise<MeterPaymentResponse> {
    const { meterId, startDate, endDate } = request;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Additional date validation
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO date strings (YYYY-MM-DD)');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const payments = await Payment.aggregate([
      {
        $match: {
          meterId,
          paymentDate: { $gte: start, $lte: end },
          status: 'completed' // Only count completed payments
        }
      },
      {
        $group: {
          _id: null,
          totalPayment: { $sum: '$amount' },
          paymentCount: { $sum: 1 }
        }
      }
    ]);

    const result = payments[0] || { totalPayment: 0, paymentCount: 0 };

    return {
      meterId,
      startDate,
      endDate,
      totalPayment: Number(result.totalPayment.toFixed(2)),
      paymentCount: result.paymentCount
    };
  }

  /**
   * Retrieve overall total payment for a given month
   */
  async getTotalPaymentForMonth(
    request: GetMonthlyPaymentRequest
  ): Promise<MonthlyPaymentResponse> {
    const { month, year } = request;

    // Month validation is now handled by Zod schema
    const payments = await Payment.aggregate([
      {
        $match: {
          month,
          year,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalPayment: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          uniqueMeters: { $addToSet: '$meterId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalPayment: 1,
          paymentCount: 1,
          uniqueMeters: { $size: '$uniqueMeters' }
        }
      }
    ]);

    const result = payments[0] || { 
      totalPayment: 0, 
      paymentCount: 0, 
      uniqueMeters: 0 
    };

    return {
      month,
      year,
      totalPayment: Number(result.totalPayment.toFixed(2)),
      paymentCount: result.paymentCount,
      uniqueMeters: result.uniqueMeters
    };
  }

  /**
   * Retrieve total daily consumption for all meters
   */
  async getTotalDailyConsumption(
    date?: string
  ): Promise<DailyConsumptionResponse> {
    // If no date provided, use today
    const targetDate = date ? new Date(date) : new Date();
    
    // Date format validation is handled by Zod schema
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Use ISO date string (YYYY-MM-DD)');
    }

    // Set to start of day for consistent querying
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const consumptions = await MeterDailyEnergyConsumption.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const consumptionByMeter: DailyConsumptionItem[] = consumptions.map(c => ({
      meterId: c.meterId,
      date: c.date.toISOString().split('T')[0],
      consumptionKwh: Number(c.consumptionKwh.toFixed(1))
    }));

    const totalConsumptionKwh = consumptions.reduce(
      (sum, c) => sum + c.consumptionKwh, 
      0
    );

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalConsumptionKwh: Number(totalConsumptionKwh.toFixed(1)),
      meterCount: consumptions.length,
      consumptionByMeter
    };
  }

  /**
   * Retrieve overall total payment for a given year with monthly breakdown
   */
  async getTotalPaymentForYear(
    request: GetYearlyPaymentRequest
  ): Promise<YearlyPaymentResponse> {
    const { year } = request;

    // Get yearly totals
    const yearlyAggregation = await Payment.aggregate([
      {
        $match: {
          year,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalPayment: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          uniqueMeters: { $addToSet: '$meterId' }
        }
      }
    ]);

    // Get monthly breakdown
    const monthlyAggregation = await Payment.aggregate([
      {
        $match: {
          year,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$month',
          totalPayment: { $sum: '$amount' },
          paymentCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const yearlyResult = yearlyAggregation[0] || {
      totalPayment: 0,
      paymentCount: 0,
      uniqueMeters: []
    };

    // Month names for better readability
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthlyBreakdown = monthlyAggregation.map(m => ({
      month: m._id,
      monthName: monthNames[m._id - 1],
      totalPayment: Number(m.totalPayment.toFixed(2)),
      paymentCount: m.paymentCount
    }));

    return {
      year,
      totalPayment: Number(yearlyResult.totalPayment.toFixed(2)),
      paymentCount: yearlyResult.paymentCount,
      uniqueMeters: Array.isArray(yearlyResult.uniqueMeters) 
        ? yearlyResult.uniqueMeters.length 
        : 0,
      monthlyBreakdown
    };
  }
}


```