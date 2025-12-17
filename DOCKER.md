# Running Papa with Docker

This guide will help you run the entire Papa application stack using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)

## Quick Start

### 1. Set up environment variables

Copy the example environment file and update it with your values:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key (optional):

```bash
OPENAI_API_KEY=your_api_key_here
```

**Note:** When running with Docker, you don't need to set `DATABASE_URL` in your `.env` file. It's automatically configured in `docker-compose.yml`.

### 2. Build and start the application

```bash
docker-compose up --build
```

This command will:

- Build the Papa application Docker image
- Start PostgreSQL database
- Run database migrations automatically
- Start the application on http://localhost:3000

**Note:** To seed the database with initial data (default user and project), run:

```bash
docker compose exec app npx prisma db seed
```

This only needs to be run once on first setup.

### 3. Access the application

Open your browser and navigate to:

```
http://localhost:3000
```

## Common Commands

### Start the application (after first build)

```bash
docker-compose up
```

### Start in detached mode (background)

```bash
docker-compose up -d
```

### Stop the application

```bash
docker-compose down
```

### Stop and remove all data (including database)

```bash
docker-compose down -v
```

### View logs

```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just the database
docker-compose logs -f postgres
```

### Rebuild the application

If you make code changes, rebuild the Docker image:

```bash
docker-compose up --build
```

### Run Prisma commands

```bash
# Generate Prisma Client
docker-compose exec app npx prisma generate

# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed database
docker-compose exec app npx prisma db seed

# Open Prisma Studio
docker-compose exec app npx prisma studio
```

### Access the database directly

```bash
docker-compose exec postgres psql -U papa -d papa_db
```

## Development vs Production

### For Development (recommended)

Run the app locally with hot-reload:

```bash
# Start only the database
docker-compose up postgres

# In another terminal, run the app locally
npm install
npm run dev
```

This gives you faster development with hot-reloading while still using the dockerized database.

### For Production-like Testing

Use the full Docker setup as described in the Quick Start section.

## Troubleshooting

### Port conflicts

If port 3000 or 5432 is already in use, you can change them in `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5433:5432" # Change 5432 to 5433 on host

  app:
    ports:
      - "3001:3000" # Change 3000 to 3001 on host
```

### Database connection issues

If the app can't connect to the database:

1. Check that PostgreSQL is healthy:

   ```bash
   docker-compose ps
   ```

2. Check database logs:

   ```bash
   docker-compose logs postgres
   ```

3. Verify the connection string in `docker-compose.yml` matches your PostgreSQL configuration.

### Reset everything

To start completely fresh:

```bash
docker-compose down -v
docker-compose up --build
```

This removes all volumes (including database data) and rebuilds from scratch.

## Environment Variables

The Docker setup uses these environment variables:

| Variable         | Default                 | Description                    |
| ---------------- | ----------------------- | ------------------------------ |
| `DATABASE_URL`   | Set automatically       | PostgreSQL connection string   |
| `OPENAI_API_KEY` | (none)                  | OpenAI API key for AI features |
| `NODE_ENV`       | `production`            | Node environment               |
| `ORIGIN`         | `http://localhost:3000` | App origin URL                 |

## Data Persistence

Your database data is stored in a Docker volume named `papa_postgres_data`. This persists across container restarts. To completely remove the data, use:

```bash
docker-compose down -v
```

## Next Steps

- Check out the main [README.md](./README.md) for application features
- Review [TIMEZONE.md](./TIMEZONE.md) for timezone handling details
- See [MENTIONS.md](./MENTIONS.md) for mention parsing features
