# Energy Meters MCP Server

A production-ready **Model Context Protocol (MCP)** server for managing energy meter data using **Streamable HTTP transport**. Built with TypeScript, Express, MongoDB, and **Zod validation**.

## 🚀 Quick Start

```bash
# 1. Create project directory
mkdir energy-meters-mcp-server
cd energy-meters-mcp-server

# 2. Initialize project (copy all files to this directory)

# 3. Install dependencies
npm install

# 4. Start MongoDB with Docker
docker-compose up -d

# 5. Configure environment
cp .env.example .env

# 6. Seed sample data
npm run seed

# 7. Start the server
npm run dev
```

Server will be available at **http://localhost:3000/mcp** 🎉

---

## 📁 Project Structure

```
energy-meters-mcp-server/
├── src/
│   ├── server.ts              # Main MCP server (stateless HTTP pattern)
│   ├── types.ts               # TypeScript type definitions
│   ├── schemas.ts             # Mongoose schemas & models
│   ├── db-config.ts           # MongoDB connection management
│   ├── mongodb-service.ts     # Database query service
│   └── seed.ts                # Database seeding script
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── docker-compose.yml         # MongoDB + Mongo Express
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── README.md                  # This file
├── ZOD_VALIDATION.md          # Zod validation guide
├── ZOD_QUICK_REFERENCE.md     # Quick reference for Zod
└── MIGRATION_TO_ZOD.md        # What changed with Zod
```

---

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn**
- **Docker** (optional, for MongoDB) ([Download](https://www.docker.com/))

---

## 🛠️ Detailed Setup

### Step 1: Copy All Files

Create the following file structure and copy the content from the artifacts:

1. Create `src/` directory
2. Copy all `.ts` files to `src/`
3. Copy configuration files to root
4. Copy `docker-compose.yml` to root

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `@modelcontextprotocol/sdk` - MCP SDK
- `express` - HTTP server
- `mongoose` - MongoDB ODM
- `dotenv` - Environment variables
- TypeScript and dev tools

### Step 3: Start MongoDB

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d
```

This starts:
- **MongoDB** on `localhost:27017`
- **Mongo Express** (web UI) on `http://localhost:8081`

To stop:
```bash
docker-compose down
```

To view logs:
```bash
docker-compose logs -f mongodb
```

**Option B: Local MongoDB Installation**

Install MongoDB locally and ensure it's running on port 27017.

### Step 4: Configure Environment

```bash
cp .env.example .env
```

**For Docker MongoDB with authentication:**
```env
MONGODB_URI=mongodb://admin:password@localhost:27017/energy_meters_db?authSource=admin
PORT=3000
NODE_ENV=development
```

**For local MongoDB without authentication:**
```env
MONGODB_URI=mongodb://localhost:27017/energy_meters_db
PORT=3000
NODE_ENV=development
```

### Step 5: Seed the Database

```bash
npm run seed
```

This creates:
- 4 energy meters
- 9 payment records (across different months)
- Daily consumption data for October 2025

### Step 6: Start the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

You should see:
```
MongoDB connected successfully
Energy Meters MCP Server running on http://localhost:3000
MCP endpoint: http://localhost:3000/mcp
Health check: http://localhost:3000/health
```

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run seed` | Populate database with sample data |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Check TypeScript types |
| `npm run clean` | Remove build directory |

---

## 🎯 MCP Tools

The server exposes four tools for querying energy meter data:

### 1. `get_meter_payment_total`

**Description:** Get total payments for a specific meter within a date range.

**Parameters:**
```json
{
  "meterId": "METER-001",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response:**
```json
{
  "meterId": "METER-001",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "totalPayment": 150.50,
  "paymentCount": 1
}
```

---

### 4. `get_yearly_payment_total`

**Description:** Get total payments across all meters for an entire year with monthly breakdown.

**Parameters:**
```json
{
  "year": 2024
}
```

**Response:**
```json
{
  "year": 2024,
  "totalPayment": 1087.75,
  "paymentCount": 6,
  "uniqueMeters": 3,
  "monthlyBreakdown": [
    {
      "month": 1,
      "monthName": "January",
      "totalPayment": 526.50,
      "paymentCount": 3
    },
    ...
  ]
}
```

---

### 2. `get_monthly_payment_total`

**Description:** Get overall payment totals for all meters in a specific month.

**Parameters:**
```json
{
  "month": 10,
  "year": 2025
}
```

**Response:**
```json
{
  "month": 10,
  "year": 2025,
  "totalPayment": 600.50,
  "paymentCount": 3,
  "uniqueMeters": 3
}
```

---

### 3. `get_daily_consumption_all_meters`

**Description:** Get total energy consumption across all meters for a specific day.

**Parameters:**
```json
{
  "date": "2025-10-15"
}
```

**Response:**
```json
{
  "date": "2025-10-15",
  "totalConsumptionKwh": 147.3,
  "meterCount": 3,
  "consumptionByMeter": [
    {
      "meterId": "METER-001",
      "date": "2025-10-15",
      "consumptionKwh": 45.5
    },
    ...
  ]
}
```

---

## 🧪 Testing the Server

### Method 1: MCP Inspector (Recommended)

```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Start the inspector
mcp-inspector
```

**Configuration:**
1. Open `http://localhost:6274` in your browser
2. Select **Transport Type:** `Streamable HTTP`
3. Set **URL:** `http://localhost:3000/mcp`
4. Click **Connect**
5. Click **List Tools** to see available tools
6. Test each tool with sample parameters

---

### Method 2: Claude Desktop

Add to your Claude Desktop configuration:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "energy-meters": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop and you'll see the energy meters tools available!

---

### Method 3: curl (Manual Testing)

**Health check:**
```bash
curl http://localhost:3000/health
```

**List tools:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Call a tool:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_monthly_payment_total",
      "arguments": {
        "month": 10,
        "year": 2025
      }
    }
  }'
```

---

## 🏗️ Architecture Highlights

### Zod Validation ✨

This server uses **Zod** for schema validation and type safety:

```typescript
// Define schema once
const GetMonthlyPaymentSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100)
});

// Get TypeScript types automatically
type Request = z.infer<typeof GetMonthlyPaymentSchema>;

// Validate at runtime
const validated = GetMonthlyPaymentSchema.parse(input);

// Generate JSON schema for MCP
const jsonSchema = zodToJsonSchema(GetMonthlyPaymentSchema);
```

**Benefits:**
- ✅ Type-safe request/response handling
- ✅ Runtime validation with clear error messages
- ✅ Automatic JSON schema generation for MCP tools
- ✅ Single source of truth for types and validation

See [ZOD_VALIDATION.md](./ZOD_VALIDATION.md) for detailed examples.

### Stateless Streamable HTTP Pattern

Following the video tutorial's technique:

```typescript
// Per-request transport instantiation
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined // No session management
});

await mcpServer.connect(transport);
res.on('close', () => transport.close());
await transport.handleRequest(req, res, req.body);
```

**Benefits:**
- ✅ Horizontally scalable
- ✅ No sticky sessions required
- ✅ Scale-to-zero friendly
- ✅ Serverless compatible
- ✅ No memory leaks

### Clean Architecture

- **Separation of concerns** - Each file has a single responsibility
- **Type safety** - Full TypeScript coverage
- **Mongoose schemas** - Data validation at the model level
- **Connection pooling** - Efficient database connections
- **Proper indexing** - Optimized query performance

---

## 📊 Database Collections

### energy_meters
- `meterId` (unique)
- `location`
- `installationDate`
- `status`

### payments
- `paymentId` (unique)
- `meterId` (indexed)
- `amount`
- `paymentDate` (indexed)
- `month`, `year` (compound index)
- `status`

### meters_daily_energy_consumption
- `meterId` (indexed)
- `date` (indexed)
- `consumptionKwh`
- `peakHours`
- `offPeakHours`

**Unique constraint:** `{ meterId, date }`

---

## 🔍 Monitoring & Debugging

### View MongoDB Data

**Mongo Express Web UI:**
- URL: `http://localhost:8081`
- Browse collections, run queries, view documents

**MongoDB Compass:**
- Connection string: `mongodb://admin:password@localhost:27017/`
- Database: `energy_meters_db`

### Server Logs

The server logs all important events:
- Database connection status
- Incoming requests
- Query execution
- Errors

---

## 🚢 Deployment

### Serverless Platforms

This stateless architecture is perfect for:
- **AWS Lambda** + API Gateway
- **Google Cloud Functions**
- **Cloudflare Workers** (with D1 database)
- **Vercel Edge Functions**
- **Railway**
- **Render**

### Docker Deployment

Build and run with Docker:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
docker build -t energy-meters-mcp .
docker run -p 3000:3000 --env-file .env energy-meters-mcp
```

---

## 🔒 Security Considerations

For production deployment:

1. **Add authentication**
   - API keys
   - OAuth 2.0
   - JWT tokens

2. **Enable CORS**
   - Restrict allowed origins
   - Configure headers

3. **Rate limiting**
   - Prevent abuse
   - Use express-rate-limit

4. **Input validation**
   - Sanitize user input
   - Validate parameters

5. **Environment variables**
   - Never commit `.env`
   - Use secrets management

6. **MongoDB authentication**
   - Enable auth in production
   - Use strong passwords
   - Restrict network access

---

## 🐛 Troubleshooting

### MongoDB Connection Failed

**Problem:** `Failed to connect to MongoDB`

**Solutions:**
```bash
# Check if MongoDB is running
docker-compose ps

# Restart MongoDB
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Verify connection string in .env
```

### Port Already in Use

**Problem:** `Port 3000 is already in use`

**Solution:**
```bash
# Change PORT in .env
PORT=3001

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### TypeScript Compilation Errors

**Problem:** TypeScript errors during build

**Solution:**
```bash
# Clean and rebuild
npm run clean
npm run build

# Check for type errors
npm run type-check
```

---

## 📚 Learn More

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Streamable HTTP Video Tutorial](https://www.youtube.com/watch?v=nTPeM8l3zTg)
- [Mongoose Documentation](https://mongoosejs.com)
- [Express.js Guide](https://expressjs.com)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

## 📄 License

MIT License - feel free to use this in your projects!

---

## ✨ Features Roadmap

- [ ] Authentication & authorization
- [ ] Real-time consumption monitoring
- [ ] Predictive analytics
- [ ] Cost forecasting tools
- [ ] Anomaly detection
- [ ] Multi-tenant support
- [ ] GraphQL API
- [ ] Webhook notifications
- [ ] Data export tools
- [ ] Dashboard UI

---

**Built with ❤️ using the Streamable HTTP MCP pattern**

For questions or support, please open an issue on GitHub.