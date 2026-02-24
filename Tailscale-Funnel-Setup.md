# Tailscale Funnel Setup for Procurement System

## Prerequisites

1. Install Tailscale: https://tailscale.com/download
2. Login to Tailscale: `tailscale login`
3. Enable Funnel: `tailscale funnel --advertise-routes 443`

## Steps

### 1. Start the Vite preview server (runs on port 4173)
```bash
npm run preview
```

### 2. In another terminal, create Tailscale Funnel
```bash
# For the current directory (will get a public HTTPS URL)
tailscale funnel 4173

# Or use a specific hostname
tailscale funnel --hostname my-procurement-app 4173
```

### 3. Access via HTTPS
Tailscale will provide a URL like:
- `https://your-machine-name.ts.net`
- `https://my-procurement-app.ts.net`

## Quick Start Script (Windows)

Create `funnel.bat` in the project root:

```batch
@echo off
echo Starting Vite preview server...
start "Vite Preview" cmd /k "npm run preview"

echo Waiting for server to start...
timeout /t 3 /nobreak > nul

echo Starting Tailscale Funnel...
start "Tailscale Funnel" cmd /k "tailscale funnel 4173"
```

## Quick Start Script (Mac/Linux)

Create `funnel.sh`:

```bash
#!/bin/bash
echo "Starting Vite preview server..."
npm run preview &
sleep 3
echo "Starting Tailscale Funnel..."
tailscale funnel 4173
```

## Notes

- Tailscale Funnel requires HTTPS port (443) - Vite preview uses 4173 but Funnel handles the HTTPS
- Camera API will work over the Tailscale HTTPS URL
- Your phone/laptop must be connected to the same Tailscale network to access the app
