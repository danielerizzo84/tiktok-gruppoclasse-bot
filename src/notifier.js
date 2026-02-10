import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { logger } from './logger.js';

/**
 * Telegram Notifier to send generated videos to the user
 */
class TelegramNotifier {
    constructor(token, chatId) {
        this.token = token;
        this.chatId = chatId;
        this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    }

    async sendMessage(text) {
        try {
            await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: text,
                parse_mode: 'HTML'
            });
            logger.success('Telegram message sent');
        } catch (error) {
            logger.error('Failed to send Telegram message:', error.message);
        }
    }

    async sendVideo(videoPath, caption) {
        try {
            logger.step('Sending video to Telegram...');
            const formData = new FormData();
            formData.append('chat_id', this.chatId);
            formData.append('video', fs.createReadStream(videoPath));
            if (caption) {
                formData.append('caption', caption);
            }

            const response = await axios.post(`${this.baseUrl}/sendVideo`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data.ok) {
                logger.success('Video sent to Telegram successfully');
                return true;
            } else {
                throw new Error(response.data.description);
            }
        } catch (error) {
            logger.error('Failed to send video to Telegram:', error.response?.data?.description || error.message);
            return false;
        }
    }
}

export default TelegramNotifier;
