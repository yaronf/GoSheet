# GoSheet - Makefile for Electron Development
# See README.md for "When to Run Which Tests" guidance

.PHONY: install test test-unit test-electron test-all build build-server-arm64 build-server-x64 build-server-universal build-electron run run-electron lint complexity coverage clean

# Install Node.js dependencies
install:
	@echo "Installing Node.js dependencies..."
	npm install

# Fast feedback: unit + Electron tests (run during development)
test: test-unit test-electron

# Go unit tests (co-located with packages)
test-unit:
	@echo "Running Go unit tests..."
	go test ./model/... ./controller/... ./api/... -v

# Playwright Electron tests
test-electron:
	@echo "Running Playwright Electron tests..."
	npm test

# All tests: unit + Electron (run before PR)
test-all: test-unit test-electron

# Build Go HTTP server (host architecture)
build:
	@echo "Building Go HTTP server..."
	go build -o server/gosheet-server ./server

# Story 10.9: Cross-compile Go server for universal macOS (arm64 + x64)
build-server-arm64:
	@echo "Building Go server for darwin/arm64..."
	GOOS=darwin GOARCH=arm64 go build -o server/gosheet-server-arm64 ./server

build-server-x64:
	@echo "Building Go server for darwin/amd64..."
	GOOS=darwin GOARCH=amd64 go build -o server/gosheet-server-x64 ./server

build-server-universal: generate build-server-arm64 build-server-x64
	@echo "Universal Go server binaries ready."

# Generate Go types from OpenAPI schema (Story 10.10)
generate:
	@echo "Generating Go types from OpenAPI..."
	oapi-codegen -generate types -package generated -o api/generated/types.go api/openapi.yaml

# Build Electron app (.app bundle)
build-electron: generate install build
	@echo "Building Electron app..."
	npm run build

# Run Go HTTP server (web mode for testing)
run: build
	@echo "Starting Go HTTP server on http://localhost:3000"
	./server/gosheet-server --port 3000

# Run Electron app in development mode
run-electron: install build
	@echo "Starting Electron app..."
	npm start

# Lint Go code
lint:
	@echo "Running golangci-lint..."
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run ./...

# Go test coverage (co-located with packages)
coverage:
	@echo "Running Go coverage..."
	@go test -coverprofile=coverage.out -coverpkg=./model,./controller,./api ./model/... ./controller/... ./api/... 2>/dev/null || true
	@echo ""
	@echo "Coverage summary (per-file):"
	@test -f coverage.out && awk '/^mode:/ { next } NF>=3 { key=$$1; stmts=$$2+0; count=$$3+0; if (count>cov[key]) cov[key]=count; stmts_key[key]=stmts } END { for (k in stmts_key) { f=k; sub(/:[0-9]+\.[0-9]+,[0-9]+\.[0-9]+$$/,"",f); t[f]+=stmts_key[k]; c[f]+=stmts_key[k]*cov[k] } for (x in t) printf "%s: %.1f%%\n", x, (t[x]>0 ? c[x]/t[x]*100 : 0) }' coverage.out 2>/dev/null | sort || echo "(no coverage.out - run tests first)"
	@echo ""
	@echo "Total:"
	@test -f coverage.out && go tool cover -func=coverage.out 2>/dev/null | grep "^total:" || echo "(no coverage.out)"

# Complexity analysis for Go (cyclomatic complexity)
complexity:
	@echo "Running gocyclo (complexity >10)..."
	@go run github.com/fzipp/gocyclo/cmd/gocyclo@latest -over 10 . 2>/dev/null || true
	@echo ""
	@echo "Functions with complexity >15:"
	@go run github.com/fzipp/gocyclo/cmd/gocyclo@latest -over 15 . 2>/dev/null || true

# Build and install app to /Applications
install: build-electron
	@echo "Installing GoSheet to /Applications..."
	@APP=$$([ -d "dist/mac-arm64/GoSheet.app" ] && echo "dist/mac-arm64/GoSheet.app" || echo "dist/mac/GoSheet.app"); \
	sudo cp -r "$$APP" /Applications/GoSheet.app && echo "Installed $$APP to /Applications/GoSheet.app"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f server/gosheet-server server/gosheet-server-arm64 server/gosheet-server-x64
	rm -rf dist/ node_modules/
