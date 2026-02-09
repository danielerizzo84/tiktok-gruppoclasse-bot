import ffmpeg from 'fluent-ffmpeg';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import config from './config.js';
import googleTTS from 'google-tts-api';
import axios from 'axios';
export class VideoGenerator {
    constructor() {
        this.width = config.video.width;
        this.height = config.video.height;
        this.fps = config.video.fps;
    }
    /**
     * Remove emojis and special characters that don't render well
     */
    removeEmojis(text) {
        return text
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc symbols
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
            .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
            .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental symbols
            .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Extended symbols
            .trim();
    }
    /**
     * Generate audio from text using Google TTS
     */
    async generateAudio(text, outputPath) {
        try {
            logger.step('Generating audio with TTS...');
            // Google TTS API returns a URL to the audio file
            const audioUrl = googleTTS.getAudioUrl(text, {
                lang: config.tts.language,
                slow: config.tts.voiceSpeed < 1,
                host: 'https://translate.google.com',
            });
            // Download the audio file
            const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(outputPath, response.data);
            logger.success(`Audio generated: ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(`Failed to generate audio: ${error.message}`);
            throw error;
        }
    }
    /**
     * Create background image with text
     */
    createTextImage(text, outputPath) {
        logger.step('Creating text image...');
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');
        // WhatsApp-style background
        ctx.fillStyle = '#ECE5DD'; // WhatsApp beige background
        ctx.fillRect(0, 0, this.width, this.height);
        // Subtle pattern overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
        for (let i = 0; i < this.height; i += 60) {
            ctx.fillRect(0, i, this.width, 30);
        }
        // Chat bubble container
        const bubbleMargin = 80;
        const bubbleY = 280;
        const bubbleHeight = this.height - bubbleY - 200;
        // Shadow for bubble
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        // WhatsApp green bubble
        ctx.fillStyle = '#DCF8C6'; // WhatsApp light green
        this.roundRect(ctx, bubbleMargin, bubbleY, this.width - (bubbleMargin * 2), bubbleHeight, 20);
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        // Header background
        ctx.fillStyle = '#128C7E'; // WhatsApp dark green
        ctx.fillRect(0, 0, this.width, 250);
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('gruppoclasse.it', this.width / 2, 130);
        ctx.fillStyle = '#E8F5E9';
        ctx.font = '45px Arial';
        ctx.fillText('Le Perle', this.width / 2, 200);
        // Clean text from emojis
        text = this.removeEmojis(text);
        // Main text (perla) - darker for readability on green
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 52px Arial';
        ctx.textAlign = 'center';
        // Word wrap
        const maxWidth = this.width - 200; // More padding for bubble
        const lineHeight = 75;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });
        lines.push(currentLine);
        // Center text vertically inside bubble
        const totalHeight = lines.length * lineHeight;
        let y = 350 + (bubbleHeight - totalHeight) / 2;
        lines.forEach(line => {
            ctx.fillText(line.trim(), this.width / 2, y);
            y += lineHeight;
        });
        // WhatsApp-style timestamp footer
        ctx.font = '32px Arial';
        ctx.fillStyle = '#128C7E';
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        ctx.fillText(timeStr, this.width - 150, this.height - 80);
        // Save to file
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        logger.success(`Text image created: ${outputPath}`);
        return outputPath;
    }
    /**
   * Helper to draw rounded rectangles
   */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
    /**
     * Generate video from image and audio
     */
    async generateVideo(imagePath, audioPath, outputPath) {
        return new Promise((resolve, reject) => {
            logger.step('Generating video with FFmpeg...');
            ffmpeg()
                .input(imagePath)
                .loop(30) // Loop image
                .input(audioPath)
                .outputOptions([
                    '-c:v libx264',
                    '-tune stillimage',
                    '-c:a aac',
                    '-b:a 192k',
                    '-pix_fmt yuv420p',
                    '-shortest',
                    '-vf scale=1080:1920',
                    '-r 30'
                ])
                .output(outputPath)
                .on('start', (commandLine) => {
                    logger.step(`FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        logger.step(`Processing: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', () => {
                    logger.success(`Video generated: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    logger.error(`FFmpeg error: ${err.message}`);
                    reject(err);
                })
                .run();
        });
    }
    /**
     * Main function to create TikTok video from text
     */
    async createTikTokVideo(perla) {
        const timestamp = Date.now();
        const tempDir = path.join(config.paths.videos, 'temp');
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const imagePath = path.join(tempDir, `image-${timestamp}.png`);
        const audioPath = path.join(tempDir, `audio-${timestamp}.mp3`);
        const videoPath = path.join(config.paths.videos, `video-${perla.id}-${timestamp}.mp4`);
        try {
            logger.step(`Creating TikTok video for perla: ${perla.id}`);
            // Step 1: Generate audio
            await this.generateAudio(perla.text, audioPath);
            // Step 2: Create text image
            this.createTextImage(perla.text, imagePath);
            // Step 3: Combine into video
            await this.generateVideo(imagePath, audioPath, videoPath);
            // Cleanup temp files
            fs.unlinkSync(imagePath);
            fs.unlinkSync(audioPath);
            logger.success(`TikTok video ready: ${videoPath}`);
            return {
                videoPath,
                perlaId: perla.id,
            };
        } catch (error) {
            logger.error(`Failed to create video: ${error.message}`);
            // Cleanup on error
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            throw error;
        }
    }
}
// Test function
async function test() {
    const generator = new VideoGenerator();
    const testPerla = {
        id: 'test-001',
        text: 'Buongiorno! Ma qualcuno sa a che ora è la recita? Non ho ricevuto nessuna comunicazione! Grazie mille! 🙏',
    };
    try {
        await generator.createTikTokVideo(testPerla);
        logger.success('Test completed successfully!');
    } catch (error) {
        logger.error('Test failed:', error);
    }
}
// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test();
}
