# Project structure

```
.
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ src/
│  ├─ index.ts
│  ├─ transport/streamableHttp.ts
│  ├─ mcp/tools.ts
│  ├─ db/config.ts
│  ├─ db/schemas/
│  │  ├─ energyMeter.ts
│  │  ├─ payment.ts
│  │  └─ dailyConsumption.ts
│  ├─ services/mongoService.ts
│  └─ types.ts
```

---

### package.json
```json
{
  "name": "mcp-energy-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.2.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.6.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

---

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

### .env.example
```
# HTTP server
PORT=3000

# Mongo
MONGODB_URI=mongodb://localhost:27017/energy
MONGODB_DEBUG=false
```

---

### src/types.ts
```ts
import { z } from "zod";

// Shared Zod schemas for tool inputs
export const DateISO = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid ISO date");

export const MeterId = z.string().min(1);

export const Period = z.object({
  start: DateISO,
  end: DateISO
}).refine(({ start, end }) => new Date(start) <= new Date(end), {
  message: "start must be <= end",
});

export type TPeriod = z.infer<typeof Period>;

export const YearMonth = z.object({
  year: z.number().int().gte(1970).lte(3000),
  month: z.number().int().gte(1).lte(12),
});

export type TYearMonth = z.infer<typeof YearMonth>;

export const OptionalDate = z.object({ date: DateISO.optional() });

// Tool input shapes
export const TotalForMeterInput = z.object({
  meterId: MeterId,
  period: Period,
});

export const TotalForMonthInput = YearMonth;

export const DailyTotalsInput = z.object({
  start: DateISO.optional(),
  end: DateISO.optional(),
});

// Tool result shapes
export type MoneyTotal = { currency: string; amount: number };
export type DailyTotal = { date: string; kWh: number };
```

---

### src/db/config.ts
```ts
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const debug = String(process.env.MONGODB_DEBUG) === "true";

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set("debug", debug);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });
}

export async function closeMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
```

---

### src/db/schemas/energyMeter.ts
```ts
import mongoose, { Schema } from "mongoose";

export interface EnergyMeterDoc {
  _id: string; // meterId
  serialNumber: string;
  customerName?: string;
  installedAt?: Date;
}

const EnergyMeterSchema = new Schema<EnergyMeterDoc>({
  _id: { type: String, required: true },
  serialNumber: { type: String, required: true, index: true },
  customerName: String,
  installedAt: Date,
}, { timestamps: true });

export const EnergyMeter = mongoose.models.EnergyMeter ||
  mongoose.model<EnergyMeterDoc>("EnergyMeter", EnergyMeterSchema, "energy_meters");
```

---

### src/db/schemas/payment.ts
```ts
import mongoose, { Schema } from "mongoose";

export interface PaymentDoc {
  _id?: string;
  meterId: string;
  amount: number; // in smallest unit or major unit—assume major for now
  currency: string; // e.g., "USD" or "LRD"
  paidAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>({
  meterId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  paidAt: { type: Date, required: true, index: true },
}, { timestamps: true });

PaymentSchema.index({ meterId: 1, paidAt: 1 });

export const Payment = mongoose.models.Payment ||
  mongoose.model<PaymentDoc>("Payment", PaymentSchema, "payments");
```

---

### src/db/schemas/dailyConsumption.ts
```ts
import mongoose, { Schema } from "mongoose";

export interface DailyConsumptionDoc {
  _id?: string;
  meterId: string;
  date: string; // YYYY-MM-DD
  kWh: number;
}

const DailyConsumptionSchema = new Schema<DailyConsumptionDoc>({
  meterId: { type: String, required: true, index: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  kWh: { type: Number, required: true, min: 0 },
}, { timestamps: true });

DailyConsumptionSchema.index({ date: 1 });
DailyConsumptionSchema.index({ meterId: 1, date: 1 }, { unique: true });

export const DailyConsumption = mongoose.models.DailyConsumption ||
  mongoose.model<DailyConsumptionDoc>("DailyConsumption", DailyConsumptionSchema, "meters_daily_energy_consumption");
```

---

### src/services/mongoService.ts
```ts
import { Payment } from "../db/schemas/payment.js";
import { DailyConsumption } from "../db/schemas/dailyConsumption.js";
import { TPeriod, TYearMonth, DailyTotal } from "../types.js";

/** Sum of payments for a meter in [start, end] inclusive */
export async function totalPaymentForMeter(meterId: string, period: TPeriod) {
  const start = new Date(period.start);
  const end = new Date(period.end);

  const [result] = await Payment.aggregate([
    { $match: { meterId, paidAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$currency",
        amount: { $sum: "$amount" },
      },
    },
  ]).exec();

  if (!result) return { currency: "USD", amount: 0 }; // default fallback
  return { currency: result._id as string, amount: result.amount as number };
}

/** Overall total payment for a month (calendar) across all meters */
export async function totalPaymentForMonth({ year, month }: TYearMonth) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // If you support multiple currencies, you may want to group by currency and return an array
  const totals = await Payment.aggregate([
    { $match: { paidAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$currency",
        amount: { $sum: "$amount" },
      },
    },
  ]).exec();

  // Return an object keyed by currency for clarity
  const byCurrency: Record<string, number> = {};
  for (const t of totals) byCurrency[t._id as string] = t.amount as number;
  return byCurrency;
}

/** Total daily consumption for all meters; optional range */
export async function totalDailyConsumption(params?: { start?: string; end?: string }): Promise<DailyTotal[]> {
  const match: Record<string, any> = {};
  if (params?.start && params?.end) {
    match.date = { $gte: params.start, $lte: params.end };
  } else if (params?.start) {
    match.date = { $gte: params.start };
  } else if (params?.end) {
    match.date = { $lte: params.end };
  }

  const rows = await DailyConsumption.aggregate([
    Object.keys(match).length ? { $match: match } : { $match: {} },
    {
      $group: {
        _id: "$date",
        kWh: { $sum: "$kWh" },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();

  return rows.map((r) => ({ date: r._id as string, kWh: r.kWh as number }));
}
```

---

### src/mcp/tools.ts
```ts
import { McpServer } from "@modelcontextprotocol/sdk";
import { z } from "zod";
import { connectMongo } from "../db/config.js";
import { totalDailyConsumption, totalPaymentForMeter, totalPaymentForMonth } from "../services/mongoService.js";
import { DailyTotalsInput, TotalForMeterInput, TotalForMonthInput } from "../types.js";

export function buildServer() {
  const server = new McpServer({ name: "energy-mcp", version: "1.0.0" });

  // Tool: total payment for a given meter in a period
  server.tool(
    "payments.total_for_meter",
    "Retrieve the total payment for a meter within a date range (inclusive).",
    {
      inputSchema: TotalForMeterInput,
      outputSchema: z.object({ currency: z.string(), amount: z.number() }),
      handler: async (input) => {
        await connectMongo();
        const result = await totalPaymentForMeter(input.meterId, input.period);
        return result;
      },
    }
  );

  // Tool: overall total payments for a month across all meters
  server.tool(
    "payments.total_for_month",
    "Retrieve the overall total payments across all meters for a calendar month.",
    {
      inputSchema: TotalForMonthInput,
      outputSchema: z.record(z.string(), z.number()),
      handler: async (input) => {
        await connectMongo();
        return await totalPaymentForMonth(input);
      },
    }
  );

  // Tool: total daily consumption (optionally in a range)
  server.tool(
    "consumption.daily_totals",
    "Retrieve total daily kWh across all meters, optionally bounded by start/end (YYYY-MM-DD)",
    {
      inputSchema: DailyTotalsInput,
      outputSchema: z.array(z.object({ date: z.string(), kWh: z.number() })),
      handler: async (input) => {
        await connectMongo();
        return await totalDailyConsumption({ start: input.start, end: input.end });
      },
    }
  );

  return server;
}
```

---

### src/transport/streamableHttp.ts
```ts
import type { Request, Response } from "express";
import { buildServer } from "../mcp/tools.js";

// NOTE: The exact import path may vary by SDK version.
// If this import fails, check the SDK docs for the current path.
// Common alternatives seen in examples:
//   import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/http";
//   import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/transports/http";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/http";

const server = buildServer();

export async function handleMcpRequest(req: Request, res: Response) {
  // Create a new transport per request (stateless)
  const transport = new StreamableHTTPServerTransport();
  await server.connect(transport);

  // Stream JSON-RPC over a single HTTP response
  await transport.handleRequest(req, res, req.body);
}
```

---

### src/index.ts
```ts
import express from "express";
import dotenv from "dotenv";
import { handleMcpRequest } from "./transport/streamableHttp.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

// Single endpoint that speaks MCP Streamable HTTP
app.post("/mcp", async (req, res) => {
  try {
    await handleMcpRequest(req, res);
  } catch (err) {
    console.error("MCP error:", err);
    res.status(500).json({ error: "Internal MCP server error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`MCP server listening on http://localhost:${port}/mcp`);
});
```

---

## Example requests

> The MCP transport is usually used by an MCP client, but you can hit it with curl for sanity.

**payments.total_for_meter**
```bash
curl -N \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:3000/mcp \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "payments.total_for_meter",
      "arguments": {
        "meterId": "MTR-001",
        "period": { "start": "2025-01-01T00:00:00Z", "end": "2025-01-31T23:59:59Z" }
      }
    }
  }'
```

**payments.total_for_month**
```bash
curl -N \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:3000/mcp \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "payments.total_for_month",
      "arguments": { "year": 2025, "month": 10 }
    }
  }'
```

**consumption.daily_totals**
```bash
curl -N \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:3000/mcp \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "consumption.daily_totals",
      "arguments": { "start": "2025-10-01", "end": "2025-10-15" }
    }
  }'
```

---

## Notes & production tips

- **Currency handling**: if you ingest multi-currency payments, either (a) store a normalized major currency value (e.g., USD) at write time, or (b) adjust the aggregations to return an array grouped by currency.
- **Timezones**: payment periods use Date objects; ensure your ingestion stores UTC timestamps to avoid DST pitfalls.
- **Indexes**: provided compound indexes support the queries above. Consider TTL or archival for very old consumption docs if volume is high.
- **Validation**: Zod schemas give the MCP client strong, introspectable contracts.
- **Stateless HTTP**: one transport per request allows easy horizontal scaling and serverless hosting.
```
