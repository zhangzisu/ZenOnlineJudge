/*
 *  Package  : libs
 *  Filename : email.js
 *  Create   : 2018-02-17
 */

const Bluebird = require('bluebird');
const nodemailer = require('nodemailer');

let doSendEmail;

const smtpConfig = {
    host: zoj.config.register_mail.host,
    port: zoj.config.register_mail.port,
    secure: false,
    auth: {
        user: zoj.config.register_mail.username,
        pass: zoj.config.register_mail.password
    },
    tls: {
        rejectUnauthorized: !zoj.config.register_mail.allowUnauthorizedTls
    }
};
const transporter = Bluebird.promisifyAll(nodemailer.createTransport(smtpConfig));

doSendEmail = async function send_smtp(to, subject, body) {
    await transporter.sendMailAsync({
        from: `"${zoj.config.title}" <${zoj.config.register_mail.username}>`,
        to: to,
        subject: subject,
        html: body
    });
};

module.exports.send = doSendEmail;