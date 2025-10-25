```ts
// types.ts - Type definitions with Zod schemas
import { z } from 'zod';

// ============================================================================
// Database Model Interfaces (keep these for Mongoose)
// ============================================================================

export interface IEnergyMeter {
  meterId: string;
  location: string;
  installationDate: Date;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface IPayment {
  paymentId: string;
  meterId: string;
  amount: number;
  paymentDate: Date;
  month: number;
  year: number;
  status: 'completed' | 'pending' | 'failed';
}

export interface IMeterDailyEnergyConsumption {
  meterId: string;
  date: Date;
  consumptionKwh: number;
  peakHours: number;
  offPeakHours: number;
}

// ============================================================================
// Zod Schemas for MCP Tool Inputs
// ============================================================================

// Schema for get_meter_payment_total tool
export const GetMeterPaymentSchema = z.object({
  meterId: z.string()
    .min(1, 'Meter ID is required')
    .describe('The unique identifier of the energy meter'),
  
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .describe('Start date in ISO format (YYYY-MM-DD)'),
  
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .describe('End date in ISO format (YYYY-MM-DD)')
}).strict();

// Schema for get_monthly_payment_total tool
export const GetMonthlyPaymentSchema = z.object({
  month: z.number()
    .int('Month must be an integer')
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12')
    .describe('Month (1-12)'),
  
  year: z.number()
    .int('Year must be an integer')
    .min(2000, 'Year must be between 2000 and 2100')
    .max(2100, 'Year must be between 2000 and 2100')
    .describe('Year (e.g., 2024)')
}).strict();

// Schema for get_daily_consumption_all_meters tool
export const GetDailyConsumptionSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .describe('Date in ISO format (YYYY-MM-DD). If not provided, uses today\'s date.')
}).strict();

// Schema for get_yearly_payment_total tool
export const GetYearlyPaymentSchema = z.object({
  year: z.number()
    .int('Year must be an integer')
    .min(2000, 'Year must be between 2000 and 2100')
    .max(2100, 'Year must be between 2000 and 2100')
    .describe('Year (e.g., 2024)')
}).strict();

// ============================================================================
// TypeScript Types Inferred from Zod Schemas
// ============================================================================

export type GetMeterPaymentRequest = z.infer<typeof GetMeterPaymentSchema>;
export type GetMonthlyPaymentRequest = z.infer<typeof GetMonthlyPaymentSchema>;
export type GetDailyConsumptionRequest = z.infer<typeof GetDailyConsumptionSchema>;
export type GetYearlyPaymentRequest = z.infer<typeof GetYearlyPaymentSchema>;

// ============================================================================
// Response Types
// ============================================================================

export const MeterPaymentResponseSchema = z.object({
  meterId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  totalPayment: z.number(),
  paymentCount: z.number()
});

export const MonthlyPaymentResponseSchema = z.object({
  month: z.number(),
  year: z.number(),
  totalPayment: z.number(),
  paymentCount: z.number(),
  uniqueMeters: z.number()
});

export const DailyConsumptionItemSchema = z.object({
  meterId: z.string(),
  date: z.string(),
  consumptionKwh: z.number()
});

export const DailyConsumptionResponseSchema = z.object({
  date: z.string(),
  totalConsumptionKwh: z.number(),
  meterCount: z.number(),
  consumptionByMeter: z.array(DailyConsumptionItemSchema)
});

export const YearlyPaymentResponseSchema = z.object({
  year: z.number(),
  totalPayment: z.number(),
  paymentCount: z.number(),
  uniqueMeters: z.number(),
  monthlyBreakdown: z.array(z.object({
    month: z.number(),
    monthName: z.string(),
    totalPayment: z.number(),
    paymentCount: z.number()
  }))
});

// Export response types
export type MeterPaymentResponse = z.infer<typeof MeterPaymentResponseSchema>;
export type MonthlyPaymentResponse = z.infer<typeof MonthlyPaymentResponseSchema>;
export type DailyConsumptionResponse = z.infer<typeof DailyConsumptionResponseSchema>;
export type DailyConsumptionItem = z.infer<typeof DailyConsumptionItemSchema>;
export type YearlyPaymentResponse = z.infer<typeof YearlyPaymentResponseSchema>;