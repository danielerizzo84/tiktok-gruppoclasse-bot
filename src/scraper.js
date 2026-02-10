import { logger } from './logger.js';
import config from './config.js';
import fs from 'fs';
import path from 'path';
export class ContentScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }
    async initialize() {
        // No browser needed for Google Sheets CSV, but keeping method for compatibility
        logger.step('Initializing content fetcher...');
    }
    async close() {
        // Nothing to close
    }
    async getPerle() {
        return new Promise(async (resolve, reject) => {
            try {
                logger.step('Fetching perle from Google Sheet...');
                // Public Google Sheet CSV URL
                const sheetId = '1RDwxQMQCIBVigJijppbNgAtNPQZ7MNf9z7zYJn_PZm8';
                const gid = '1971420613'; // GID for "Perle" tab
                const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                // Fetch CSV
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Sheet fetch failed: ${response.statusText}`);
                const csvText = await response.text();
                // Parse CSV (robust state-machine parser to avoid infinite loops)
                const rows = csvText.split('\n').map(line => {
                    const result = [];
                    let cur = '';
                    let inQuote = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuote = !inQuote;
                        } else if (char === ',' && !inQuote) {
                            result.push(cur.trim());
                            cur = '';
                        } else {
                            cur += char;
                        }
                    }
                    result.push(cur.trim());
                    return result;
                });
                // Skip header row
                const dataRows = rows.slice(1);
                const perle = [];
                let count = 0;
                for (const row of dataRows) {
                    // Column A is "testo" (index 0)
                    const text = row[0] ? row[0].trim() : '';
                    if (text && text.length > 10) {
                        // Generate a consistent ID based on text hash or content
                        // Using a simple hash to keep ID stable
                        const safeText = text.substring(0, 20).replace(/[^a-z0-9]/gi, '');
                        const id = `perla-${safeText}-${text.length}`;
                        perle.push({
                            id: id,
                            text: text,
                            author: row[2] || 'Anonimo', // Column C is autore
                            category: row[1] || 'Generale' // Column B is categoria
                        });
                        count++;
                    }
                }
                logger.success(`Fetched ${count} perle from Google Sheet`);
                resolve(perle);
            } catch (error) {
                logger.error('Error fetching from Google Sheet:', error);
                reject(error);
            }
        });
    }
    // Alias for backward compatibility if main.js calls scrapePerle
    async scrapePerle() {
        return this.getPerle();
    }
}
// Database helper functions
export class ContentDatabase {
    constructor() {
        this.dbPath = config.db.contentFile;
        this.ensureDatabase();
    }
    ensureDatabase() {
        // Ensure data directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            logger.step('Creating content database...');
            fs.writeFileSync(this.dbPath, JSON.stringify({ perle: [] }, null, 2));
            logger.success('Database created');
        }
    }
    read() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            return { perle: [] };
        }
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
