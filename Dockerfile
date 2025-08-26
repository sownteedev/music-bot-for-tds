FROM node:24-alpine

# Install FFmpeg and build dependencies
RUN apk add --no-cache ffmpeg python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (without --only=production for native modules)
RUN npm install

# Copy source code
COPY . .

# Expose port (optional for Railway)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
