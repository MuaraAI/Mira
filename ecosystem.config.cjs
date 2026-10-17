module.exports = {
  apps: [
    {
      name: "ubsi-api",
      cwd: "/opt/ubsi-api",
      script: "/home/ubuntu/.venvs/ubsi-api/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8300 --workers 2",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "ubsi-mcp",
      cwd: "/opt/ubsi-api",
      script: "/home/ubuntu/.venvs/ubsi-api/bin/python",
      args: "-m app.mcp_server --transport streamable-http --host 127.0.0.1 --port 8350 --path /mcp",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "100M",
      env: {
        UBSI_API_URL: "http://127.0.0.1:8300"
      }
    }
  ]
};
