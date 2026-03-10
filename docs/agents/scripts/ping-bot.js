import 'dotenv/config';
import { argv } from 'node:process';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_BOT_CHAT_ID;
const taskTitle = argv[2] || 'Unknown Task';
const message = `${taskTitle} — HITL Required`;

if (!token) process.exit(1);

fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
}).catch(console.error);
