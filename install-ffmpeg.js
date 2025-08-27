const { execSync } = require('child_process');

function installFFmpeg() {
    try {
        // Check if ffmpeg exists
        execSync('which ffmpeg', { stdio: 'ignore' });
        // FFmpeg already available
        return;
    } catch (error) {
        // FFmpeg not found, attempt installation
    }

    try {
        // Try to install ffmpeg using apt-get (Ubuntu/Debian)
        execSync('apt-get update && apt-get install -y ffmpeg', { stdio: 'pipe' });
        console.log('✅ FFmpeg installed successfully');
    } catch (error) {
        console.error('❌ Failed to install FFmpeg:', error.message);
        console.log('💡 Try running: sudo apt-get install ffmpeg');
    }
}

// Only install if we're in production
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    installFFmpeg();
}
