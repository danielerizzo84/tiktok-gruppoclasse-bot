import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (stack) {
            log += `\n${stack}`;
        }
        return log;
    })
);

// Create logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Console output with colors
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            ),
        }),
        // File output for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // File output for errors only
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});

// Helper methods
logger.success = (message) => logger.info(`✓ ${message}`);
logger.step = (message) => logger.info(`→ ${message}`);

export default logger;
