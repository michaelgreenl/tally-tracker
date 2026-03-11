import 'dotenv/config';
import { argv } from 'node:process';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_BOT_CHAT_ID;
const initiativeTitle = argv[2] || 'Unknown Initiative';
const currentStep = argv[3] || 'Unknown Step';
const currentStepDescriptor = argv[4] || 'Unknown Step';

const message = `${initiativeTitle}  — HITL Required \nStep: ${currentStep} \nTask: ${currentStepDescriptor}`;

if (!token) process.exit(1);

fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
}).catch(console.error);
