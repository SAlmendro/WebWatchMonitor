import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import nodemailer from 'nodemailer';
import notifier from 'node-notifier';


let url;
let sender;
let appPassword;
let seconds;
const receivers = [];

import readline from 'readline';
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askUser(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function takeScreenshot() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
    await page.screenshot({ path: 'screenshot_new.png', fullPage: true });

    await browser.close();
}

function compareScreenshots() {
    if (!fs.existsSync('screenshot_old.png')) {
        fs.renameSync('screenshot_new.png', 'screenshot_old.png');
        return false;
    }

    const img1 = PNG.sync.read(fs.readFileSync('screenshot_old.png'));
    const img2 = PNG.sync.read(fs.readFileSync('screenshot_new.png'));

    // If the image sizes do not match, the web has changed
    if (img1.width !== img2.width || img1.height !== img2.height) {
        console.log("Image sizes do not match. The web has changed.");
        return true;
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    try {
        const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
            threshold: 0 // Sensitivity to changes, 0 = strict, 1 = lenient
        });

        if (numDiffPixels > 0) {
            fs.writeFileSync('diff.png', PNG.sync.write(diff));
            return true;
        } else {
            fs.unlinkSync('screenshot_new.png');
            return false;
        }
    } catch (error) {
        console.error("Error comparing images:", error);
        return true; // If there is an error, we assume the web has changed
    }
}

async function sendEmail(changed) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: sender,
            pass: appPassword
        }
    });

    let emailPromises = [];

    if (changed) {
        console.log('Changes detected, sending mail...');
        notifier.notify({
            title: 'The web changed!',
            message: 'Go see it!',
            sound: true
        });

        receivers.forEach(receiver => {
            emailPromises.push(
                transporter.sendMail({
                    from: sender,
                    to: receiver,
                    subject: 'Changes detected in the web!',
                    text: 'The web has changed! Run! Go see it: ' + url,
                    attachments: [
                        { filename: 'screenshot_new.png', path: './screenshot_new.png' },
                        { filename: 'screenshot_old.png', path: './screenshot_old.png' }
                    ]
                })
            );
        });
    } else {
        let firstReceiver = receivers[0];
        emailPromises.push(
            transporter.sendMail({
                from: sender,
                to: firstReceiver,
                subject: "Web monitoring subscription",
                text: "You've been subscribed to the changes in this web: " + url
            })
        );
    }

    return Promise.all(emailPromises);
}

async function checkWeb() {
    await takeScreenshot();
    const changed = compareScreenshots();

    const currentTime = new Date().toLocaleString();

    if (changed) {
        await sendEmail(true);
        fs.renameSync('screenshot_new.png', 'screenshot_old.png');
        console.log(`The content has changed - ${currentTime}`);
    } else {
        console.log(`The content remains the same - ${currentTime}`);
    }
}


async function main() {
    url = await askUser("Enter the URL of the website you wish to monitor: ");
    seconds = await askUser("Enter how often you want to monitor the website (in seconds): ");
    const nReceivers = await askUser("Enter the number of receivers you want to send the updates: ");
    
    for (let i = 1; i <= nReceivers; i++) {
        const receiver = await askUser(`Enter the #${i} recipient's email address: `);
        receivers.push(receiver);
    }

    sender = await askUser("Enter the sender's email address (Gmail): ");
    appPassword = await askUser("Enter your Gmail application password: ");
    rl.close();

    console.log("Starting visual web monitoring...");
    sendEmail(false);
    checkWeb();
    setInterval(checkWeb, seconds * 1000);
}

main();
