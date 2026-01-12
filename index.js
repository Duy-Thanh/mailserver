require('dotenv').config(); // Gọi thằng bảo vệ
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Để chứa CSS/JS nếu cần

const config = {
    imap: {
        user: process.env.MAIL_USER,
        password: process.env.MAIL_PASS,
        host: process.env.MAIL_HOST,
        port: process.env.IMAP_PORT,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 3000
    },
    smtp: {
        host: process.env.MAIL_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
};

// 1. TRANG CHỦ (CÓ PHÂN TRANG)
app.get('/', async (req, res) => {
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Logic phân trang đơn giản
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: ['HEADER'], struct: true, markSeen: false };
        let messages = await connection.search(searchCriteria, fetchOptions);

        // Đảo ngược để thấy mail mới nhất
        messages.reverse();

        const totalEmails = messages.length;
        const totalPages = Math.ceil(totalEmails / limit);
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedMessages = messages.slice(start, end);

        const emails = paginatedMessages.map(msg => ({
            from: msg.parts[0].body.from[0],
            subject: msg.parts[0].body.subject[0],
            date: msg.parts[0].body.date[0],
            id: msg.attributes.uid,
            seen: msg.attributes.flags && msg.attributes.flags.includes('\\Seen')
        }));

        connection.end();
        res.render('home', {
            emails,
            user: process.env.MAIL_USER,
            currentPage: page,
            totalPages,
            msg: req.query.msg
        });
    } catch (err) {
        res.render('error', { error: err });
    }
});

// 2. ĐỌC MAIL & TRẢ LỜI
app.get('/read/:uid', async (req, res) => {
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = [['UID', req.params.uid]];
        const fetchOptions = { bodies: [''], markSeen: true };
        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length > 0) {
            const all = messages[0].parts.filter(part => part.which === '');
            const id = messages[0].attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";

            const parsed = await simpleParser(idHeader + all[0].body);

            // Xử lý file đính kèm (Hiển thị tên thôi)
            const attachments = parsed.attachments ? parsed.attachments.map(att => att.filename) : [];

            connection.end();
            res.render('read', { mail: parsed, uid: id, attachments });
        } else {
            connection.end();
            res.redirect('/?msg=Không tìm thấy mail');
        }
    } catch (err) {
        res.send("Lỗi: " + err);
    }
});

// 3. GỬI MAIL
app.post('/send', async (req, res) => {
    const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: `"${config.smtp.user}" <${config.smtp.user}>`,
            to: req.body.to,
            subject: req.body.subject,
            html: req.body.message.replace(/\n/g, '<br>') // Convert xuống dòng thành HTML
        });
        res.redirect('/?msg=Đã gửi thư thành công! 🚀');
    } catch (err) {
        res.send("Lỗi gửi mail: " + err);
    }
});

app.listen(9200, () => {
    console.log('🚀 Javalorant Mail v2 chạy tại http://localhost:9200');
});