Copy-Item -LiteralPath ".env.example" -Destination ".env" -ErrorAction SilentlyContinue
docker compose up -d

