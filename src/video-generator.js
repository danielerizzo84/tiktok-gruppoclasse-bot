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

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        // Add decorative elements
        ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
        ctx.beginPath();
        ctx.arc(this.width * 0.2, this.height * 0.15, 150, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(78, 205, 196, 0.1)';
        ctx.beginPath();
        ctx.arc(this.width * 0.8, this.height * 0.85, 200, 0, Math.PI * 2);
        ctx.fill();

        // Title at top
        ctx.fillStyle = config.video.accentColor;
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GRUPPO CLASSE', this.width / 2, 150);

        ctx.fillStyle = '#ffffff';
        ctx.font = '40px Arial';
        ctx.fillText('Le Perle 💎', this.width / 2, 220);

        // Main text (perla)
        ctx.fillStyle = config.video.textColor;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';

        // Word wrap
        const maxWidth = this.width - 120;
        const lineHeight = 70;
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

        // Center text vertically
        const totalHeight = lines.length * lineHeight;
        let y = (this.height - totalHeight) / 2 + 100;

        lines.forEach(line => {
            ctx.fillText(line.trim(), this.width / 2, y);
            y += lineHeight;
        });

        // Footer
        ctx.font = '35px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText('gruppoclasse.it', this.width / 2, this.height - 80);

        // Save to file
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        logger.success(`Text image created: ${outputPath}`);
        return outputPath;
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
