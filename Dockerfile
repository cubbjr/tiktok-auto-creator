# Simple production-ready Node 18 image with FFmpeg installed
FROM node:18-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files and install production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy remaining source
COPY . .

# Expose port (Render will honor $PORT)
EXPOSE 10000

# Start the server
CMD ["node", "src/server.js"]
