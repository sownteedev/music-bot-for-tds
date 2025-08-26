#!/bin/bash

# Install FFmpeg if not available
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing FFmpeg..."
    
    # Try different package managers
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y ffmpeg
    elif command -v apk &> /dev/null; then
        apk add --no-cache ffmpeg
    elif command -v yum &> /dev/null; then
        yum install -y ffmpeg
    else
        echo "FFmpeg installation failed - using ffmpeg-static package"
    fi
fi

# Start the bot
node bot-distube.js
