import { chromium } from 'playwright';
import { logger } from './logger.js';
import config from './config.js';
import path from 'path';
import fs from 'fs';

export class TikTokClient {
    constructor() {
        this.browser = null;
        this.page = null;
        this.context = null;
        this.sessionPath = path.join(config.paths.data, 'tiktok-session.json');
    }

    /**
     * Initialize browser with persistent session
     */
    async initialize() {
        logger.step('Initializing TikTok browser...');

        this.browser = await chromium.launch({
            headless: true, // Force headless for GitHub Actions
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Create context with persistent storage
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            locale: 'it-IT',
        });

        // Load saved cookies if they exist
        if (fs.existsSync(this.sessionPath)) {
            logger.step('Loading saved session...');
            const cookies = JSON.parse(fs.readFileSync(this.sessionPath, 'utf-8'));
            await this.context.addCookies(cookies);
        }

        this.page = await this.context.newPage();
        logger.success('Browser initialized');
    }

    /**
     * Login to TikTok (manual process, will save session)
     */
    async login() {
        try {
            logger.step('Navigating to TikTok...');
            await this.page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle' });

            // Check if already logged in
            const isLoggedIn = await this.checkIfLoggedIn();

            if (isLoggedIn) {
                logger.success('Already logged in!');
                return true;
            }

            logger.step('Please log in manually in the browser window...');
            logger.step('Waiting for login to complete (checking every 5 seconds)...');

            // Wait for user to log in manually (check every 5 seconds for 5 minutes)
            const maxAttempts = 60; // 5 minutes
            let attempts = 0;

            while (attempts < maxAttempts) {
                await this.page.waitForTimeout(5000);

                if (await this.checkIfLoggedIn()) {
                    logger.success('Login successful!');

                    // Save session
                    const cookies = await this.context.cookies();
                    fs.writeFileSync(this.sessionPath, JSON.stringify(cookies, null, 2));
                    logger.success('Session saved');

                    return true;
                }

                attempts++;
            }

            throw new Error('Login timeout - please try again');

        } catch (error) {
            logger.error(`Login failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if user is logged in
     */
    async checkIfLoggedIn() {
        try {
            // Look for common elements that appear when logged in
            const loggedInIndicators = [
                '[data-e2e="profile-icon"]',
                'button[data-e2e="upload-icon"]',
                '[href*="/upload"]',
            ];

            for (const selector of loggedInIndicators) {
                const element = await this.page.$(selector);
                if (element) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Upload video to TikTok
     */
    async uploadVideo(videoPath, caption) {
        try {
            logger.step(`Uploading video: ${videoPath}`);

            // Navigate to upload page
            await this.page.goto('https://www.tiktok.com/upload', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(2000);

            // Find and click the file input
            logger.step('Selecting video file...');
            const fileInput = await this.page.$('input[type="file"]');

            if (!fileInput) {
                throw new Error('File upload input not found');
            }

            await fileInput.setInputFiles(videoPath);
            logger.success('Video file selected');

            // Wait for upload to process
            logger.step('Waiting for video to process...');
            await this.page.waitForTimeout(10000);

            // Add caption
            logger.step('Adding caption and hashtags...');
            const captionSelector = 'div[contenteditable="true"], textarea[placeholder*="escri"]';
            await this.page.waitForSelector(captionSelector, { timeout: 15000 });

            const fullCaption = `${caption}\n\n${config.hashtags.join(' ')}`;
            await this.page.fill(captionSelector, fullCaption);
            logger.success('Caption added');

            // Set privacy settings (optional - defaults are usually fine)
            // You can add privacy setting logic here if needed

            // Find and click publish button
            logger.step('Publishing video...');
            const publishButton = await this.page.$('button[data-e2e="publish-button"], button:has-text("Pubblica"), button:has-text("Post")');

            if (!publishButton) {
                logger.warn('Publish button not found - may need manual intervention');
                logger.step('Please publish the video manually in the browser window');
                await this.page.waitForTimeout(30000); // Wait 30 seconds for manual publish
            } else {
                await publishButton.click();
                logger.success('Publish button clicked');

                // Wait for upload to complete
                await this.page.waitForTimeout(15000);
            }

            // Check for success
            const isSuccess = await this.checkUploadSuccess();

            if (isSuccess) {
                logger.success('Video uploaded successfully!');
                return true;
            } else {
                logger.warn('Upload status uncertain - please check TikTok manually');
                return false;
            }

        } catch (error) {
            logger.error(`Upload failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if upload was successful
     */
    async checkUploadSuccess() {
        try {
            // Look for success indicators
            const successIndicators = [
                'text=pubblicato',
                'text=posted',
                'text=success',
                '[data-e2e="upload-success"]',
            ];

            for (const selector of successIndicators) {
                const element = await this.page.$(selector);
                if (element) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Generate caption for video
     */
    generateCaption(perla) {
        const captions = [
            `Le perle del giorno dai gruppi classe! 💎😂`,
            `Quando le mamme del gruppo WhatsApp si scatenano... 📱`,
            `Le chat scolastiche be like... 🎒📚`,
            `Gruppo classe, sempre una sorpresa! 🤦‍♀️`,
            `Le perle dai gruppi scuola che non ti aspetti! 💬`,
        ];

        // Pick a random caption
        const randomCaption = captions[Math.floor(Math.random() * captions.length)];

        return randomCaption;
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            logger.step('Browser closed');
        }
    }
}

// Test function
async function test() {
    const client = new TikTokClient();

    try {
        await client.initialize();
        await client.login();

        logger.step('Test completed - browser will remain open');
        logger.step('Press Ctrl+C to exit');

        // Keep process alive
        await new Promise(() => { });

    } catch (error) {
        logger.error('Test failed:', error);
        await client.close();
    }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test();
}
