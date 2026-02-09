import { AutomationScheduler } from './src/scheduler.js';
import { logger } from './src/logger.js';

async function main() {
    logger.step('=== TIKTOK GRUPPOCLASSE AUTOMATION ===');

    const scheduler = new AutomationScheduler();

    // Check if running in "once" mode (for testing)
    const runOnce = process.argv.includes('--once');

    if (runOnce) {
        logger.step('Running in ONE-TIME mode');
        await scheduler.runOnce();
    } else {
        logger.step('Running in SCHEDULER mode');
        scheduler.start();

        // Keep process alive
        process.on('SIGINT', () => {
            logger.step('Shutting down gracefully...');
            process.exit(0);
        });
    }
}

main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
