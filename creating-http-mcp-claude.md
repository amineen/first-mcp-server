/*
 * COMPLETE ENERGY METERS MCP SERVER APPLICATION
 * ==============================================
 * 
 * This is a complete, production-ready MCP server implementation.
 * Follow the instructions below to set up and run.
 * 
 * DIRECTORY STRUCTURE:
 * 
 * energy-meters-mcp-server/
 * ├── src/
 * │   ├── server.ts
 * │   ├── types.ts
 * │   ├── schemas.ts
 * │   ├── db-config.ts
 * │   ├── mongodb-service.ts
 * │   └── seed.ts
 * ├── package.json
 * ├── tsconfig.json
 * ├── docker-compose.yml
 * ├── .env.example
 * ├── .gitignore
 * └── README.md
 */
```ts
// FILE: src/types.ts

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

export interface GetMeterPaymentRequest {
  meterId: string;
  startDate: string;
  endDate: string;
}

export interface GetMonthlyPaymentRequest {
  month: number;
  year: number;
}

export interface DailyConsumptionResponse {
  meterId: string;
  date: string;
  consumptionKwh: number;
}

// ============================================================================
// FILE: src/schemas.ts
// ============================================================================

import mongoose, { Schema } from 'mongoose';
import { IEnergyMeter, IPayment, IMeterDailyEnergyConsumption } from './types';

const energyMeterSchema = new Schema<IEnergyMeter>({
  meterId: { type: String, required: true, unique: true, index: true },
  location: { type: String, required: true },
  installationDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'maintenance'], 
    default: 'active' 
  }
}, { 
  timestamps: true,
  collection: 'energy_meters'
});

const paymentSchema = new Schema<IPayment>({
  paymentId: { type: String, required: true, unique: true, index: true },
  meterId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  year: { type: Number, required: true, index: true },
  status: { 
    type: String, 
    enum: ['completed', 'pending', 'failed'], 
    default: 'pending' 
  }
}, { 
  timestamps: true,
  collection: 'payments'
});

paymentSchema.index({ year: 1, month: 1 });
paymentSchema.index({ meterId: 1, paymentDate: 1 });

const meterDailyEnergyConsumptionSchema = new Schema<IMeterDailyEnergyConsumption>({
  meterId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  consumptionKwh: { type: Number, required: true, min: 0 },
  peakHours: { type: Number, required: true, min: 0, max: 24 },
  offPeakHours: { type: Number, required: true, min: 0, max: 24 }
}, { 
  timestamps: true,
  collection: 'meters_daily_energy_consumption'
});

meterDailyEnergyConsumptionSchema.index({ meterId: 1, date: 1 }, { unique: true });

export const EnergyMeter = mongoose.model<IEnergyMeter>('EnergyMeter', energyMeterSchema);
export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export const MeterDailyEnergyConsumption = mongoose.model<IMeterDailyEnergyConsumption>(
  'MeterDailyEnergyConsumption', 
  meterDailyEnergyConsumptionSchema
);

// ============================================================================
// FILE: src/db-config.ts
// ============================================================================

import mongoose from 'mongoose';

interface DBConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

const config: DBConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/energy_meters_db',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    await mongoose.connect(config.uri, config.options);
    isConnected = true;
    console.log('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    isConnected = false;
    throw error;
  }
}

export function isDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('MongoDB connection closed');
  }
}

// ============================================================================
// FILE: src/mongodb-service.ts
// ============================================================================

import { Payment, MeterDailyEnergyConsumption } from './schemas';
import { 
  GetMeterPaymentRequest, 
  GetMonthlyPaymentRequest, 
  DailyConsumptionResponse 
} from './types';

export class MongoDBService {
  
  async getTotalPaymentForMeter(request: GetMeterPaymentRequest): Promise<{
    meterId: string;
    startDate: string;
    endDate: string;
    totalPayment: number;
    paymentCount: number;
  }> {
    const { meterId, startDate, endDate } = request;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO date strings (YYYY-MM-DD)');
    }

    const payments = await Payment.aggregate([
      {
        $match: {
          meterId,
          paymentDate: { $gte: start, $lte: end },
          status: 'completed'
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
      totalPayment: result.totalPayment,
      paymentCount: result.paymentCount
    };
  }

  async getTotalPaymentForMonth(request: GetMonthlyPaymentRequest): Promise<{
    month: number;
    year: number;
    totalPayment: number;
    paymentCount: number;
    uniqueMeters: number;
  }> {
    const { month, year } = request;

    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }

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
      totalPayment: result.totalPayment,
      paymentCount: result.paymentCount,
      uniqueMeters: result.uniqueMeters
    };
  }

  async getTotalDailyConsumption(date?: string): Promise<{
    date: string;
    totalConsumptionKwh: number;
    meterCount: number;
    consumptionByMeter: DailyConsumptionResponse[];
  }> {
    const targetDate = date ? new Date(date) : new Date();
    
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Use ISO date string (YYYY-MM-DD)');
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const consumptions = await MeterDailyEnergyConsumption.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const consumptionByMeter: DailyConsumptionResponse[] = consumptions.map(c => ({
      meterId: c.meterId,
      date: c.date.toISOString().split('T')[0],
      consumptionKwh: c.consumptionKwh
    }));

    const totalConsumptionKwh = consumptions.reduce(
      (sum, c) => sum + c.consumptionKwh, 
      0
    );

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalConsumptionKwh,
      meterCount: consumptions.length,
      consumptionByMeter
    };
  }
}

```

### FILE: src/server.ts
```ts

import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable-http.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { connectToDatabase, isDBConnected } from './db-config';
import { MongoDBService } from './mongodb-service';
import { 
  GetMeterPaymentRequest, 
  GetMonthlyPaymentRequest 
} from './types';

const app = express();
app.use(express.json());

const dbService = new MongoDBService();

const mcpServer = new Server(
  {
    name: 'energy-meters-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_meter_payment_total',
        description: 'Retrieve the total payment for a specific meter within a date range. Returns the sum of all completed payments for the meter during the specified period.',
        inputSchema: {
          type: 'object',
          properties: {
            meterId: {
              type: 'string',
              description: 'The unique identifier of the energy meter'
            },
            startDate: {
              type: 'string',
              description: 'Start date in ISO format (YYYY-MM-DD)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            endDate: {
              type: 'string',
              description: 'End date in ISO format (YYYY-MM-DD)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            }
          },
          required: ['meterId', 'startDate', 'endDate']
        }
      },
      {
        name: 'get_monthly_payment_total',
        description: 'Retrieve the overall total payment for all meters for a specific month and year. Returns aggregated payment data including total amount, payment count, and number of unique meters.',
        inputSchema: {
          type: 'object',
          properties: {
            month: {
              type: 'number',
              description: 'Month (1-12)',
              minimum: 1,
              maximum: 12
            },
            year: {
              type: 'number',
              description: 'Year (e.g., 2024)',
              minimum: 2000,
              maximum: 2100
            }
          },
          required: ['month', 'year']
        }
      },
      {
        name: 'get_daily_consumption_all_meters',
        description: 'Retrieve the total daily energy consumption for all meters on a specific date. Returns total consumption in kWh and breakdown by individual meters.',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in ISO format (YYYY-MM-DD). If not provided, uses today\'s date.',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            }
          }
        }
      }
    ]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!isDBConnected()) {
      await connectToDatabase();
    }

    switch (name) {
      case 'get_meter_payment_total': {
        const result = await dbService.getTotalPaymentForMeter(
          args as GetMeterPaymentRequest
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_monthly_payment_total': {
        const result = await dbService.getTotalPaymentForMonth(
          args as GetMonthlyPaymentRequest
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_daily_consumption_all_meters': {
        const result = await dbService.getTotalDailyConsumption(
          (args as { date?: string }).date
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2)
        }
      ],
      isError: true
    };
  }
});

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await mcpServer.connect(transport);

    res.on('close', () => {
      transport.close();
    });

    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    database: isDBConnected() ? 'connected' : 'disconnected',
    server: 'energy-meters-mcp-server',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`Energy Meters MCP Server running on http://localhost:${PORT}`);
      console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();



// ============================================================================
// FILE: src/seed.ts
// ============================================================================

import { connectToDatabase, disconnectFromDatabase } from './db-config';
import { EnergyMeter, Payment, MeterDailyEnergyConsumption } from './schemas';

async function clearCollections() {
  console.log('Clearing existing data...');
  await EnergyMeter.deleteMany({});
  await Payment.deleteMany({});
  await MeterDailyEnergyConsumption.deleteMany({});
  console.log('✓ Collections cleared');
}

async function seedEnergyMeters() {
  console.log('Seeding energy meters...');
  
  const meters = [
    {
      meterId: 'METER-001',
      location: 'Building A - Floor 1',
      installationDate: new Date('2023-01-15'),
      status: 'active' as const
    },
    {
      meterId: 'METER-002',
      location: 'Building A - Floor 2',
      installationDate: new Date('2023-01-20'),
      status: 'active' as const
    },
    {
      meterId: 'METER-003',
      location: 'Building B - Main Hall',
      installationDate: new Date('2023-02-01'),
      status: 'active' as const
    },
    {
      meterId: 'METER-004',
      location: 'Building C - Warehouse',
      installationDate: new Date('2023-03-10'),
      status: 'maintenance' as const
    }
  ];

  await EnergyMeter.insertMany(meters);
  console.log(`✓ Created ${meters.length} energy meters`);
}

async function seedPayments() {
  console.log('Seeding payments...');
  
  const payments = [
    {
      paymentId: 'PAY-2024-01-001',
      meterId: 'METER-001',
      amount: 150.50,
      paymentDate: new Date('2024-01-15'),
      month: 1,
      year: 2024,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2024-01-002',
      meterId: 'METER-002',
      amount: 200.75,
      paymentDate: new Date('2024-01-18'),
      month: 1,
      year: 2024,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2024-01-003',
      meterId: 'METER-003',
      amount: 175.25,
      paymentDate: new Date('2024-01-20'),
      month: 1,
      year: 2024,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2024-02-001',
      meterId: 'METER-001',
      amount: 165.00,
      paymentDate: new Date('2024-02-15'),
      month: 2,
      year: 2024,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2024-02-002',
      meterId: 'METER-002',
      amount: 210.50,
      paymentDate: new Date('2024-02-18'),
      month: 2,
      year: 2024,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2024-02-003',
      meterId: 'METER-003',
      amount: 185.75,
      paymentDate: new Date('2024-02-20'),
      month: 2,
      year: 2024,
      status: 'pending' as const
    },
    {
      paymentId: 'PAY-2025-10-001',
      meterId: 'METER-001',
      amount: 180.00,
      paymentDate: new Date('2025-10-05'),
      month: 10,
      year: 2025,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2025-10-002',
      meterId: 'METER-002',
      amount: 225.50,
      paymentDate: new Date('2025-10-10'),
      month: 10,
      year: 2025,
      status: 'completed' as const
    },
    {
      paymentId: 'PAY-2025-10-003',
      meterId: 'METER-003',
      amount: 195.00,
      paymentDate: new Date('2025-10-15'),
      month: 10,
      year: 2025,
      status: 'completed' as const
    }
  ];

  await Payment.insertMany(payments);
  console.log(`✓ Created ${payments.length} payments`);
}

async function seedDailyConsumption() {
  console.log('Seeding daily consumption data...');
  
  const consumptions = [];
  const startDate = new Date('2025-10-01');
  const endDate = new Date('2025-10-18');
  
  const meters = ['METER-001', 'METER-002', 'METER-003'];
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    for (const meterId of meters) {
      const consumptionKwh = 40 + Math.random() * 20;
      const peakHours = 8 + Math.floor(Math.random() * 4);
      const offPeakHours = 24 - peakHours;
      
      consumptions.push({
        meterId,
        date: new Date(date),
        consumptionKwh: Math.round(consumptionKwh * 10) / 10,
        peakHours,
        offPeakHours
      });
    }
  }

  await MeterDailyEnergyConsumption.insertMany(consumptions);
  console.log(`✓ Created ${consumptions.length} daily consumption records`);
}

async function seed() {
  try {
    console.log('Starting database seeding...\n');
    
    await connectToDatabase();
    
    await clearCollections();
    await seedEnergyMeters();
    await seedPayments();
    await seedDailyConsumption();
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nSample queries you can try:');
    console.log('1. get_meter_payment_total for METER-001 in Jan 2024');
    console.log('2. get_monthly_payment_total for October 2025');
    console.log('3. get_daily_consumption_all_meters for 2025-10-15');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

seed();
```