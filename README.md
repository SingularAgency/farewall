# Farewell

A Supabase-powered application with migrations and Docker support for development.

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/) and Docker Compose
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd farewell
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development environment**
   ```bash
   npm run dev
   ```

## 🗄️ Database Migrations

### Creating a New Migration

```bash
# Create a new migration file
npm run migrate:new <migration_name>

# Example:
npm run migrate:new add_user_preferences
```

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate

# Reset database and apply all migrations
npm run reset
```

### Migration Best Practices

- Always use descriptive names for migrations
- Include both `up` and `down` operations when possible
- Test migrations on a copy of production data
- Use transactions for complex migrations
- Follow the existing migration structure in `supabase/migrations/`

## 🐳 Docker Development

The project uses Supabase CLI which automatically manages Docker containers for all services.

### Services Included

When you run `supabase start`, the following services are automatically started:

- **PostgreSQL Database** (port 54322)
- **Supabase Studio** (port 54323) - Database management UI
- **Supabase Auth** (port 54324) - Authentication service
- **Supabase REST API** (port 54325) - Auto-generated REST API
- **Supabase Realtime** (port 54326) - Real-time subscriptions
- **Supabase Storage** (port 54327) - File storage service
- **Supabase Edge Functions** (port 54328) - Serverless functions

### Accessing Services

- **Supabase Studio**: http://localhost:54323
- **Database**: `postgresql://postgres:postgres@localhost:54322/postgres`
- **API URL**: http://localhost:54321

## 📁 Project Structure

```
farewell/
├── supabase/
│   ├── migrations/          # Database migrations
│   ├── functions/           # Edge Functions
│   └── config.toml         # Supabase configuration
├── package.json           # Node.js dependencies
├── env.example            # Environment variables template
└── README.md              # This file
```

## 🔧 Development Commands

```bash
# Start Supabase local development
npm run dev

# Stop Supabase services
npm run stop

# Reset database
npm run reset

# Open Supabase Studio
npm run studio

# Create new migration
npm run migrate:new <name>

# Apply migrations
npm run migrate

# Deploy Edge Functions
npm run deploy:functions

# Test Edge Functions locally
npm run test:function
```

## 🏛️ Funeral Services API

The project includes Edge Functions for funeral-related services with Google Maps integration:

### Available Endpoints

#### 1. Search Funeral Services
**POST** `/functions/v1/funeral-services`

Search for funeral-related services near a location using Google Maps API.

**Request Body:**
```json
{
  "location": "New York, NY",
  "category": "banks",
  "radius": 5000,
  "limit": 20
}
```

**Available Categories:**
- `banks` - Banks & Financial Services
- `funeral_homes` - Funeral Homes & Services
- `legal_services` - Legal Services
- `insurance` - Insurance Services
- `government_services` - Government Services
- `counseling` - Counseling & Support

**Response:**
```json
{
  "category": "banks",
  "category_name": "Banks & Financial Services",
  "location": "New York, NY",
  "results": [
    {
      "id": "place_id",
      "name": "Bank Name",
      "address": "123 Main St, New York, NY",
      "rating": 4.5,
      "price_level": 2,
      "types": ["bank", "finance"],
      "geometry": {...},
      "business_status": "OPERATIONAL",
      "category": "banks",
      "category_name": "Banks & Financial Services"
    }
  ],
  "total_found": 15
}
```

#### 2. Manage Categories
**POST** `/functions/v1/manage-categories`

Dynamically manage funeral service categories.

**Actions:**
- `get` - Get all categories
- `add` - Add new category
- `update` - Update existing category
- `remove` - Remove category
- `toggle` - Enable/disable category

**Example - Get all categories:**
```json
{
  "action": "get"
}
```

**Example - Add new category:**
```json
{
  "action": "add",
  "category": "transportation",
  "data": {
    "name": "Transportation Services",
    "keywords": ["limousine", "hearse", "transportation"],
    "types": ["car_dealer", "travel_agency"],
    "enabled": true
  }
}
```

## 🔐 Environment Variables

Copy `env.example` to `.env` and configure:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key (required for funeral services API)

## 🚀 CI/CD Deployment

The project includes automated deployment of Supabase Edge Functions to different environments based on GitHub branches.

### Branch Mapping
- `develop` → Supabase Project: `rxpvyojjxqvtwkwdghtf`
- `staging` → Supabase Project: `jykymoqntvrmaqqfqwps`
- `main` → Supabase Project: `wmmqzbpkgbiweenvrhid`

### Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN_DEVELOP` - Access token for develop environment
- `SUPABASE_ACCESS_TOKEN_STAGING` - Access token for staging environment  
- `SUPABASE_ACCESS_TOKEN_MAIN` - Access token for main environment

**Getting Access Tokens:**
1. Go to your Supabase dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key
4. Or create a personal access token in your Supabase account settings

### Deployment Commands

```bash
# Deploy to specific environment locally
npm run deploy:develop
npm run deploy:staging
npm run deploy:main

# Deploy all functions (uses current linked project)
npm run deploy:functions
```

### Automatic Deployment

Functions are automatically deployed when:
- Pushing to `main`, `staging`, or `develop` branches
- Files in `supabase/functions/` are modified
- Manual trigger from GitHub Actions tab

### Manual Deployment

1. Go to Actions tab in GitHub
2. Select "Deploy Supabase Functions" workflow
3. Click "Run workflow"
4. Choose environment and run

## 🛠️ Supabase CLI Commands

```bash
# Initialize Supabase in existing project
npx supabase init

# Start local development
npx supabase start

# Stop local development
npx supabase stop

# Create new migration
npx supabase migration new <name>

# Apply migrations
npx supabase db push

# Reset database
npx supabase db reset

# Open Studio
npx supabase studio

# Generate TypeScript types
npx supabase gen types typescript --local > types/supabase.ts
```

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Guide](https://supabase.com/docs/guides/cli)
- [Database Migrations](https://supabase.com/docs/guides/database/migrations)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🤝 Contributing

1. Create a new migration for database changes
2. Test your changes locally using Docker
3. Follow the existing code structure and patterns
4. Update documentation as needed

## 📄 License

MIT License - see LICENSE file for details
