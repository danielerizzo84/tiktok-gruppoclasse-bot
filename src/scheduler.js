import cron from 'node-cron';
import { logger } from './logger.js';
import { ContentScraper, ContentDatabase } from './scraper.js';
import { VideoGenerator } from './video-generator.js';
import { TikTokClient } from './tiktok-client.js';
import config from './config.js';

export class AutomationScheduler {
    constructor() {
        this.db = new ContentDatabase();
        this.isRunning = false;
    }

    /**
     * Execute the full automation workflow
     */
    async executeWorkflow() {
        if (this.isRunning) {
            logger.warn('Workflow already running, skipping this execution');
            return;
        }

        this.isRunning = true;
        logger.step('=== STARTING AUTOMATION WORKFLOW ===');

        const scraper = new ContentScraper();
        const generator = new VideoGenerator();
        const tiktokClient = new TikTokClient();

        try {
            // Step 1: Scrape new perle
            logger.step('Step 1/4: Scraping perle from gruppoclasse.it');
            await scraper.initialize();
            const perle = await scraper.scrapePerle();
            await scraper.close();

            if (perle.length === 0) {
                logger.warn('No perle found on the website');
                return;
            }

            // Step 2: Add to database
            logger.step('Step 2/4: Adding perle to database');
            const addedCount = this.db.addPerle(perle);

            if (addedCount === 0) {
                logger.warn('No new perle to publish');
            }

            // Step 3: Get unpublished perla
            const unpublished = this.db.getUnpublishedPerle();

            if (unpublished.length === 0) {
                logger.warn('No unpublished perle available');
                return;
            }

            // Pick a random unpublished perla
            const perla = unpublished[Math.floor(Math.random() * unpublished.length)];
            logger.success(`Selected perla: ${perla.id}`);
            logger.step(`Text: ${perla.text.substring(0, 100)}...`);

            // Step 4: Generate video
            logger.step('Step 3/4: Generating TikTok video');
            const { videoPath } = await generator.createTikTokVideo(perla);

            // Step 5: Upload to TikTok
            logger.step('Step 4/4: Uploading to TikTok');
            await tiktokClient.initialize();

            // Check if logged in
            await tiktokClient.page.goto('https://www.tiktok.com', { waitUntil: 'networkidle' });
            const isLoggedIn = await tiktokClient.checkIfLoggedIn();

            if (!isLoggedIn) {
                logger.warn('Not logged in to TikTok - initiating login process');
                await tiktokClient.login();
            }

            const caption = tiktokClient.generateCaption(perla);
            const success = await tiktokClient.uploadVideo(videoPath, caption);

            if (success) {
                // Mark as published
                this.db.markAsPublished(perla.id, 'tiktok.com/@yourprofile'); // Update with actual URL if available
                logger.success('=== WORKFLOW COMPLETED SUCCESSFULLY ===');
            } else {
                logger.warn('Upload may not have succeeded - check manually');
            }

            await tiktokClient.close();

        } catch (error) {
            logger.error(`Workflow failed: ${error.message}`);
            logger.error(error.stack);

            // Cleanup
            if (scraper.browser) await scraper.close();
            if (tiktokClient.browser) await tiktokClient.close();

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start the scheduler
     */
    start() {
        logger.success('🚀 Automation scheduler started!');
        logger.step(`Schedule: ${config.schedule.time1} and ${config.schedule.time2}`);

        // Schedule first job
        cron.schedule(config.schedule.time1, () => {
            logger.step('⏰ Scheduled job triggered (Time 1)');
            this.executeWorkflow();
        });

        // Schedule second job
        cron.schedule(config.schedule.time2, () => {
            logger.step('⏰ Scheduled job triggered (Time 2)');
            this.executeWorkflow();
        });

        logger.success('Scheduler is now running. Press Ctrl+C to stop.');

        // Optional: run once immediately on startup for testing
        // this.executeWorkflow();
    }

    /**
     * Run workflow once (for testing)
     */
    async runOnce() {
        logger.step('Running workflow once...');
        await this.executeWorkflow();
        logger.success('Workflow completed. Exiting...');
        process.exit(0);
    }
}

// Test function
async function test() {
    const scheduler = new AutomationScheduler();

    // Run once for testing
    await scheduler.runOnce();
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test();
}
