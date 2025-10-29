```ts
// server.ts - MCP Server with Zod validation
import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable-http.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodError } from 'zod';
import { connectToDatabase, isDBConnected } from './db-config';
import { MongoDBService } from './mongodb-service';
import { 
  GetMeterPaymentSchema,
  GetMonthlyPaymentSchema,
  GetDailyConsumptionSchema,
  GetYearlyPaymentSchema,
  MeterPaymentResponseSchema,
  MonthlyPaymentResponseSchema,
  DailyConsumptionResponseSchema,
  YearlyPaymentResponseSchema
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

// Register tool list handler with Zod-generated schemas
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {inp:
  return {
    tools: [
      {
        name: 'get_meter_payment_total',
        description: 'Retrieve the total payment for a specific meter within a date range. Returns the sum of all completed payments for the meter during the specified period.',
        inputSchema: zodToJsonSchema(GetMeterPaymentSchema, {
          name: 'GetMeterPaymentInput',
          $refStrategy: 'none'
        })
      },
      {
        name: 'get_monthly_payment_total',
        description: 'Retrieve the overall total payment for all meters for a specific month and year. Returns aggregated payment data including total amount, payment count, and number of unique meters.',
        inputSchema: zodToJsonSchema(GetMonthlyPaymentSchema, {
          name: 'GetMonthlyPaymentInput',
          $refStrategy: 'none'
        })
      },
      {
        name: 'get_daily_consumption_all_meters',
        description: 'Retrieve the total daily energy consumption for all meters on a specific date. Returns total consumption in kWh and breakdown by individual meters.',
        inputSchema: zodToJsonSchema(GetDailyConsumptionSchema, {
          name: 'GetDailyConsumptionInput',
          $refStrategy: 'none'
        })
      },
      {
        name: 'get_yearly_payment_total',
        description: 'Retrieve the overall total payment for all meters for a specific year. Returns aggregated payment data including total amount, payment count, number of unique meters, and monthly breakdown.',
        inputSchema: zodToJsonSchema(GetYearlyPaymentSchema, {
          name: 'GetYearlyPaymentInput',
          $refStrategy: 'none'
        })
      }
    ]
  };
});

// Helper function to format validation errors
function formatZodError(error: ZodError): string {
  return error.errors
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join('; ');
}

// Register tool call handler with Zod validation
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Ensure database is connected
    if (!isDBConnected()) {
      await connectToDatabase();
    }

    switch (name) {
      case 'get_meter_payment_total': {
        // Validate input with Zod
        const validatedInput = GetMeterPaymentSchema.parse(args);
        
        // Call service
        const result = await dbService.getTotalPaymentForMeter(validatedInput);
        
        // Validate output with Zod
        const validatedOutput = MeterPaymentResponseSchema.parse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validatedOutput, null, 2)co
            }
          ]
        };
      }

      case 'get_monthly_payment_total': {
        // Validate input with Zod
        const validatedInput = GetMonthlyPaymentSchema.parse(args);
        
        // Call service
        const result = await dbService.getTotalPaymentForMonth(validatedInput);
        
        // Validate output with Zod
        const validatedOutput = MonthlyPaymentResponseSchema.parse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validatedOutput, null, 2)
            }
          ]
        };
      }

      case 'get_daily_consumption_all_meters': {
        // Validate input with Zod
        const validatedInput = GetDailyConsumptionSchema.parse(args);
        
        // Call service
        const result = await dbService.getTotalDailyConsumption(
          validatedInput.date
        );
        
        // Validate output with Zod
        const validatedOutput = DailyConsumptionResponseSchema.parse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validatedOutput, null, 2)
            }
          ]
        };
      }

      case 'get_yearly_payment_total': {
        // Validate input with Zod
        const validatedInput = GetYearlyPaymentSchema.parse(args);
        
        // Call service
        const result = await dbService.getTotalPaymentForYear(validatedInput);
        
        // Validate output with Zod
        const validatedOutput = YearlyPaymentResponseSchema.parse(result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validatedOutput, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const errorMessage = formatZodError(error);
      console.error('Validation error:', errorMessage);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              error: 'Validation error',
              details: errorMessage,
              issues: error.errors 
            }, null, 2)
          }
        ],
        isError: true
      };
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Tool execution error:', errorMessage);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            error: errorMessage 
          }, null, 2)
        }eSt
      ],
      isError: true
    };
  }
});

// Stateless HTTP endpoint - per-request transport pattern
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Create a new transport for this request (stateless, no session)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // No session management
    });

    // Connect the transport to the MCP server
    await mcpServer.connect(transport);

    // Clean up transport when response closes
    res.on('close', () => {
      transport.close();
    });

    // Handle the request
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    database: isDBConnected() ? 'connected' : 'disconnected',
    server: 'energy-meters-mcp-server',
    version: '1.0.0',
    validation: 'zod'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to MongoDB on startup
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`Energy Meters MCP Server running on http://localhost:${PORT}`);
      console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Validation: Zod schemas enabled`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();