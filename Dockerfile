# Sử dụng Node.js 20 LTS làm base image
FROM node:20-slim

# Cài đặt FFmpeg và các dependencies cần thiết
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Tạo thư mục làm việc
WORKDIR /app

# Copy package files
COPY package*.json ./

# Cài đặt dependencies
RUN npm install --only=production

# Copy source code
COPY . .

# Expose port (optional, for health checks)
EXPOSE 3000

# Chạy bot
CMD ["node", "bot-distube.js"]
