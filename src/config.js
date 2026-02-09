import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
    // TikTok Credentials
    tiktok: {
        username: process.env.TIKTOK_USERNAME || '',
        password: process.env.TIKTOK_PASSWORD || '',
    },

    // Scheduling
    schedule: {
        time1: process.env.SCHEDULE_TIME_1 || '0 10 * * *', // 10:00 AM
        time2: process.env.SCHEDULE_TIME_2 || '0 18 * * *', // 6:00 PM
    },

    // Hashtags
    hashtags: (process.env.HASHTAGS || '#gruppoclasse,#mamme,#scuola,#perle').split(','),

    // Video Settings
    video: {
        width: parseInt(process.env.VIDEO_WIDTH || '1080'),
        height: parseInt(process.env.VIDEO_HEIGHT || '1920'),
        duration: parseInt(process.env.VIDEO_DURATION || '15'),
        fps: 30,
        backgroundColor: '#1a1a2e',
        textColor: '#ffffff',
        accentColor: '#ff6b6b',
    },

    // TTS Settings
    tts: {
        language: process.env.TTS_LANGUAGE || 'it-IT',
        voiceSpeed: parseFloat(process.env.TTS_VOICE_SPEED || '1.0'),
    },

    // Scraping
    scraping: {
        url: process.env.GRUPPOCLASSE_URL || 'https://gruppoclasse.it',
        timeout: 30000,
    },

    // Paths
    paths: {
        data: path.join(__dirname, '..', process.env.DATA_DIR || 'data'),
        videos: path.join(__dirname, '..', process.env.VIDEOS_DIR || 'videos'),
        logs: path.join(__dirname, '..', process.env.LOGS_DIR || 'logs'),
        templates: path.join(__dirname, '..', 'templates'),
    },

    // Database
    db: {
        contentFile: path.join(__dirname, '..', 'data', 'content-db.json'),
    },
};

export default config;
