const nodemailer = require('nodemailer');
const notifier = require('node-notifier');

let url; 
let nReceivers;
const receivers = [];
let sender;
let appPassword;
let seconds;

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askUser(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

let lastVersion = '';

async function checkWeb() {
    try {
        const answer = await fetch(url);
        const content = await answer.text();

        const currentTime = new Date().toLocaleString();

        if (!lastVersion) {
            lastVersion = content;
        } else if (lastVersion !== content) {
            lastVersion = content;
            sendEmail();
            console.log(`The content has changed - ${currentTime}`);
        } else {
            console.log(`The content remains the same - ${currentTime}`);
        }
    } catch (err) {
        console.error(err);
    }
}

function sendEmail() {
    console.log('Changes detected, sending mail...');
    (async () => {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: sender,
                pass: appPassword
            }
        });
        notifier.notify({
            title: 'The web changed!',
            message: 'Go see it!',
            sound: true
        });
        receivers.forEach(async receiver => {
            await transporter.sendMail({
                from: sender,
                to: receiver,
                subject: 'Changes detected in the web!',
                text: 'The web has changed! Run! Go see it: ' + url
            });
        });
    })();
}

async function main() {
    url = await askUser("Enter the URL of the website you wish to monitor: ");
    seconds = await askUser("Enter how often you want to monitor the website (in seconds): ");
    nReceivers = await askUser("Enter the number of receivers you want to send the updates: ");
    for (let i = 1; i <= nReceivers; i++) {
        const receiver = await askUser("Enter the #" + i + " recipient's email address: ");
        receivers.push(receiver);
    }
    sender = await askUser("Enter the sender's email address (Gmail): ");
    appPassword = await askUser("Enter your Gmail application password: ");
    rl.close();

    console.log("Starting web monitoring...");
    checkWeb();
    setInterval(checkWeb, seconds*1000);
}

main();
