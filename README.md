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
```

## 🔐 Environment Variables

Copy `env.example` to `.env` and configure:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret

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
