# Fitness Station API — main commands. `make` with no target lists the commands.

.DEFAULT_GOAL := help
.PHONY: help install dev build lint format format-check typecheck test coverage docs openapi openapi-check check

help: ## List the available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# --- Setup and run ---------------------------------------------------------

install: ## Install dependencies (npm ci) and generate the Prisma client
	npm ci
	npx prisma generate

dev: ## Run the API in watch mode (needs .env and a running database)
	npm run start:dev

build: ## Compile to dist/ (nest build)
	npm run build

# --- Quality ---------------------------------------------------------------

lint: ## ESLint over src/
	npx eslint "src/**/*.ts"

format: ## Prettier: rewrite src/ files
	npx prettier --write "src/**/*.ts"

format-check: ## Prettier: fail if src/ files are not formatted
	npx prettier --check "src/**/*.ts"

typecheck: ## TypeScript compiler without emitting files
	npx tsc --noEmit -p tsconfig.json

test: ## Jest unit tests
	npx jest

coverage: ## Jest with coverage; fails below the 60% floor in jest.config.js
	npx jest --coverage

docs: ## Check docs/system against the code (tools/docs_coverage.py)
	python3 tools/docs_coverage.py

openapi: ## Regenerate openapi.json from the controllers and DTOs (no database needed)
	npm run openapi

openapi-check: openapi ## Fail if the committed openapi.json is out of date
	git diff --exit-code -- openapi.json

check: format-check lint typecheck docs openapi-check ## Everything that must pass before a commit (CI job `check`)
