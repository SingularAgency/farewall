# Farewell Project Makefile

.PHONY: help install dev stop reset migrate migrate-new studio clean

# Default target
help:
	@echo "Available commands:"
	@echo "  install      - Install dependencies"
	@echo "  dev          - Start Supabase development environment"
	@echo "  stop         - Stop Supabase services"
	@echo "  reset        - Reset database and apply migrations"
	@echo "  migrate      - Apply pending migrations"
	@echo "  migrate-new  - Create new migration (usage: make migrate-new NAME=migration_name)"
	@echo "  studio       - Open Supabase Studio"
	@echo "  clean        - Clean up Docker volumes and containers"

# Install dependencies
install:
	npm install

# Start Supabase development environment
dev:
	npm run dev

# Stop Supabase services
stop:
	npm run stop

# Reset database
reset:
	npm run reset

# Apply migrations
migrate:
	npm run migrate

# Create new migration
migrate-new:
	@if [ -z "$(NAME)" ]; then \
		echo "Usage: make migrate-new NAME=migration_name"; \
		exit 1; \
	fi
	npx supabase migration new $(NAME)

# Open Supabase Studio
studio:
	npm run studio

# Clean up Docker resources
clean:
	supabase stop
	docker system prune -f
