import { chromium } from 'playwright';
import { logger } from './logger.js';
import config from './config.js';
import fs from 'fs';

export class ContentScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        logger.step('Initializing browser for scraping...');
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
        logger.success('Browser initialized');
    }

    async scrapePerle() {
        try {
            logger.step(`Scraping perle from ${config.scraping.url}`);

            await this.page.goto(config.scraping.url, {
                waitUntil: 'networkidle',
                timeout: config.scraping.timeout,
            });

            // Wait for content to load
            await this.page.waitForSelector('article, .post, .entry, .perla', { timeout: 10000 });

            // Extract perle from the page
            const perle = await this.page.evaluate(() => {
                const items = [];

                // Try common selectors for blog posts/articles
                const selectors = [
                    'article',
                    '.post',
                    '.entry',
                    '.perla',
                    '.story',
                    '.content-item'
                ];

                let elements = [];
                for (const selector of selectors) {
                    elements = document.querySelectorAll(selector);
                    if (elements.length > 0) break;
                }

                elements.forEach((el, index) => {
                    // Try to find text content
                    const textElement = el.querySelector('p, .text, .content, .description, .body');
                    const text = textElement ? textElement.innerText.trim() : el.innerText.trim();

                    // Try to find a link or ID
                    const linkElement = el.querySelector('a[href]');
                    const href = linkElement ? linkElement.href : '';

                    // Extract ID from URL or use index
                    const urlMatch = href.match(/\/(\d+|[a-zA-Z0-9-]+)\/?$/);
                    const id = urlMatch ? urlMatch[1] : `perla-${index}`;

                    if (text && text.length > 10) { // Filter out very short texts
                        items.push({
                            id,
                            text: text.substring(0, 500), // Limit to 500 chars
                            url: href,
                            scrapedAt: new Date().toISOString(),
                        });
                    }
                });

                return items;
            });

            logger.success(`Scraped ${perle.length} perle`);
            return perle;

        } catch (error) {
            logger.error(`Error scraping perle: ${error.message}`);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            logger.step('Browser closed');
        }
    }
}

// Database helper functions
export class ContentDatabase {
    constructor() {
        this.dbPath = config.db.contentFile;
        this.ensureDatabase();
    }

    ensureDatabase() {
        if (!fs.existsSync(this.dbPath)) {
            logger.step('Creating content database...');
            fs.writeFileSync(this.dbPath, JSON.stringify({ perle: [] }, null, 2));
            logger.success('Database created');
        }
    }

    read() {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(data);
    }

    write(data) {
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }

    getUnpublishedPerle() {
        const db = this.read();
        return db.perle.filter(p => !p.published);
    }

    markAsPublished(perlaId, tiktokUrl) {
        const db = this.read();
        const perla = db.perle.find(p => p.id === perlaId);
        if (perla) {
            perla.published = true;
            perla.publishedAt = new Date().toISOString();
            perla.tiktokUrl = tiktokUrl;
            this.write(db);
            logger.success(`Marked perla ${perlaId} as published`);
        }
    }

    addPerle(newPerle) {
        const db = this.read();
        const existingIds = new Set(db.perle.map(p => p.id));

        const toAdd = newPerle.filter(p => !existingIds.has(p.id));

        if (toAdd.length > 0) {
            db.perle.push(...toAdd.map(p => ({ ...p, published: false })));
            this.write(db);
            logger.success(`Added ${toAdd.length} new perle to database`);
        } else {
            logger.step('No new perle to add');
        }

        return toAdd.length;
    }
}

// Test function
async function test() {
    const scraper = new ContentScraper();
    const db = new ContentDatabase();

    try {
        await scraper.initialize();
        const perle = await scraper.scrapePerle();

        console.log('\n=== SCRAPED PERLE ===');
        perle.forEach((p, i) => {
            console.log(`\n${i + 1}. ID: ${p.id}`);
            console.log(`   Text: ${p.text.substring(0, 100)}...`);
            console.log(`   URL: ${p.url}`);
        });

        db.addPerle(perle);

    } catch (error) {
        logger.error('Test failed:', error);
    } finally {
        await scraper.close();
    }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test();
}
