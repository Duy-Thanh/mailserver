const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// CẤU HÌNH SERVER MAIL CỦA MÀY
const MAIL_CONFIG = {
    user: 'admin@javalorant.xyz',
    password: 'Nekkochan0x0007@!', // Pass mày đặt lúc đầu
    host: 'localhost', // Chạy ngay trên server nên là localhost
    smtpPort: 587,
    imapPort: 993
};

// 1. TRANG CHỦ: HIỂN THỊ DANH SÁCH MAIL
app.get('/', async (req, res) => {
    const config = {
        imap: {
            user: MAIL_CONFIG.user,
            password: MAIL_CONFIG.password,
            host: MAIL_CONFIG.host,
            port: MAIL_CONFIG.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }, // Bỏ qua lỗi SSL tự chế
            authTimeout: 3000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Lấy 10 mail mới nhất
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: ['HEADER'], struct: true, markSeen: false };
        const messages = await connection.search(searchCriteria, fetchOptions);

        // Sắp xếp mới nhất lên đầu
        messages.reverse();
        const recentMessages = messages.slice(0, 10);

        const emails = recentMessages.map(msg => {
            return {
                from: msg.parts[0].body.from[0],
                subject: msg.parts[0].body.subject[0],
                date: msg.parts[0].body.date[0],
                id: msg.attributes.uid
            };
        });

        connection.end();
        res.render('home', { emails: emails, user: MAIL_CONFIG.user });
    } catch (err) {
        console.log(err);
        res.send("LỖI KẾT NỐI IMAP: " + err);
    }
});

// 2. ĐỌC CHI TIẾT MAIL
app.get('/read/:uid', async (req, res) => {
    const config = {
        imap: {
            user: MAIL_CONFIG.user,
            password: MAIL_CONFIG.password,
            host: MAIL_CONFIG.host,
            port: MAIL_CONFIG.imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = [['UID', req.params.uid]];
        const fetchOptions = { bodies: [''], markSeen: true }; // Lấy toàn bộ body
        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length > 0) {
            const all = messages[0].parts.filter(part => part.which === '');
            const id = messages[0].attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";

            // Parse nội dung mail ra HTML
            const parsed = await simpleParser(idHeader + all[0].body);

            res.render('read', { mail: parsed });
        } else {
            res.send("Không tìm thấy mail!");
        }
        connection.end();
    } catch (err) {
        res.send("Lỗi đọc mail: " + err);
    }
});

// 3. GỬI MAIL
app.post('/send', async (req, res) => {
    const transporter = nodemailer.createTransport({
        host: MAIL_CONFIG.host,
        port: MAIL_CONFIG.smtpPort,
        secure: false, // Dùng StartTLS
        auth: {
            user: MAIL_CONFIG.user,
            pass: MAIL_CONFIG.password
        },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: MAIL_CONFIG.user,
            to: req.body.to,
            subject: req.body.subject,
            text: req.body.message
        });
        res.redirect('/?msg=Gửi thành công!');
    } catch (err) {
        res.send("Lỗi gửi mail: " + err);
    }
});

app.listen(9090, () => {
    console.log('Webmail đang chạy tại http://localhost:9090');
});