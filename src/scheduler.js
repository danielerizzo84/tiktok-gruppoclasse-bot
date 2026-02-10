import cron from 'node-cron';
import { logger } from './logger.js';
import { ContentScraper, ContentDatabase } from './scraper.js';
import { VideoGenerator } from './video-generator.js';
import TelegramNotifier from './notifier.js';
import config from './config.js';
export class AutomationScheduler {
    constructor() {
        this.db = new ContentDatabase();
        this.isRunning = false;
        // Initialize notifier if credentials available
        if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            this.notifier = new TelegramNotifier(
                process.env.TELEGRAM_TOKEN,
                process.env.TELEGRAM_CHAT_ID
            );
        }
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
        try {
            // Step 1: Fetch from Google Sheets
            logger.step('Step 1/4: Fetching perle from Google Sheet');
            await scraper.initialize();
            const perle = await scraper.getPerle();
            await scraper.close();
            if (perle.length === 0) {
                logger.warn('No perle found in Google Sheet');
                return;
            }
            // Step 2: Add to database
            logger.step('Step 2/4: Updating database');
            const addedCount = this.db.addPerle(perle);
            // Step 3: Get unpublished perla
            const unpublished = this.db.getUnpublishedPerle();
            if (unpublished.length === 0) {
                logger.warn('No unpublished perle available');
                return;
            }
            // Pick a perla (randomly from the last 5 added to keep it fresh but varied)
            const subset = unpublished.slice(-5);
            const perla = subset[Math.floor(Math.random() * subset.length)];
            logger.success(`Selected perla: ${perla.id}`);
            logger.step(`Text: ${perla.text.substring(0, 50)}...`);
            // Step 4: Generate video
            logger.step('Step 3/4: Generating Video (WhatsApp Style)');
            const { videoPath } = await generator.createTikTokVideo(perla);
            // Step 5: Send via Telegram
            logger.step('Step 4/4: Delivering via Telegram');
            if (this.notifier) {
                const caption = `🎬 <b>Video Pronto per TikTok!</b>\n\n` +
                    `📝 <i>Testo:</i> ${perla.text}\n\n` +
                    `🏷️ <code>#gruppoclasse #mamme #scuola</code>\n\n` +
                    `🚀 Scarica il video e caricalo ora!`;
                const success = await this.notifier.sendVideo(videoPath, caption);
                if (success) {
                    // Mark as published
                    this.db.markAsPublished(perla.id, 'delivered-to-telegram');
                    logger.success('=== WORKFLOW COMPLETED: VIDEO SENT TO TELEGRAM ===');
                } else {
                    logger.error('Failed to deliver video to Telegram');
                }
            } else {
                logger.error('Telegram Notifier not configured! Set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID');
            }
        } catch (error) {
            logger.error(`Workflow failed: ${error.message}`);
            logger.error(error.stack);
            // Cleanup
            if (scraper.browser) await scraper.close();
        } finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the scheduler
     */
    start() {
        logger.success('🚀 Automation scheduler started (Telegram Delivery Mode)!');
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
// Main execution function
async function main() {
    const scheduler = new AutomationScheduler();
    // Check for --once flag
    const args = process.argv.slice(2);
    if (args.includes('--once')) {
        await scheduler.runOnce();
    } else {
        scheduler.start();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
