require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// CẤU HÌNH SESSION (Để nhớ đăng nhập)
app.use(session({
    secret: 'javalorant_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 60 * 1000 } // Tự logout sau 30 phút
}));

// MIDDLEWARE KIỂM TRA ĐĂNG NHẬP
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// CẤU HÌNH IMAP/SMTP ĐỘNG THEO USER
const getImapConfig = (user, pass) => ({
    imap: {
        user: user,
        password: pass,
        host: process.env.MAIL_HOST || '127.0.0.1',
        port: process.env.IMAP_PORT || 143,
        tls: false, // <--- QUAN TRỌNG: SỬA THÀNH FALSE
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 5000
    }
});

const getSmtpTransport = (user, pass) => nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'localhost',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
});

// --- ROUTES ---

// 1. LOGIN PAGE
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Thử kết nối IMAP để check pass
    try {
        const connection = await imaps.connect(getImapConfig(email, password));
        await connection.end();

        // Nếu ok thì lưu session
        req.session.user = email;
        req.session.pass = password;
        res.redirect('/');
    } catch (err) {
        res.render('login', { error: "Login failed! Check email/password." });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// 2. HOME PAGE (INBOX)
app.get('/', requireLogin, async (req, res) => {
    try {
        const connection = await imaps.connect(getImapConfig(req.session.user, req.session.pass));
        await connection.openBox('INBOX');

        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: ['HEADER'], struct: true, markSeen: false };
        let messages = await connection.search(searchCriteria, fetchOptions);

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
            user: req.session.user,
            currentPage: page,
            totalPages,
            msg: req.query.msg
        });
    } catch (err) {
        res.render('error', { error: err });
    }
});

// 3. READ MAIL & DOWNLOAD ATTACHMENT
app.get('/read/:uid', requireLogin, async (req, res) => {
    try {
        const connection = await imaps.connect(getImapConfig(req.session.user, req.session.pass));
        await connection.openBox('INBOX');

        const searchCriteria = [['UID', req.params.uid]];
        const fetchOptions = { bodies: [''], markSeen: true };
        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length > 0) {
            const all = messages[0].parts.filter(part => part.which === '');
            const id = messages[0].attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";

            const parsed = await simpleParser(idHeader + all[0].body);

            // Xử lý thông tin file đính kèm để hiển thị link download
            const attachments = parsed.attachments ? parsed.attachments.map(att => ({
                filename: att.filename,
                size: (att.size / 1024).toFixed(1) + ' KB',
                downloadLink: `/download/${id}/${att.filename}` // Link tải
            })) : [];

            connection.end();
            res.render('read', { mail: parsed, uid: id, attachments });
        } else {
            connection.end();
            res.redirect('/?msg=Email not found');
        }
    } catch (err) {
        res.send("Error: " + err);
    }
});

// ROUTE DOWNLOAD FILE
app.get('/download/:uid/:filename', requireLogin, async (req, res) => {
    try {
        const connection = await imaps.connect(getImapConfig(req.session.user, req.session.pass));
        await connection.openBox('INBOX');

        const searchCriteria = [['UID', req.params.uid]];
        const fetchOptions = { bodies: [''], markSeen: false };
        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length > 0) {
            const all = messages[0].parts.filter(part => part.which === '');
            const parsed = await simpleParser(all[0].body);

            const file = parsed.attachments.find(att => att.filename === req.params.filename);

            if (file) {
                res.setHeader('Content-disposition', 'attachment; filename=' + file.filename);
                res.setHeader('Content-type', file.contentType);
                res.send(file.content); // Trả về nội dung file
            } else {
                res.send("File not found!");
            }
        }
        connection.end();
    } catch (err) {
        res.send("Error downloading: " + err);
    }
});

// 4. SEND MAIL
app.post('/send', requireLogin, async (req, res) => {
    const transporter = getSmtpTransport(req.session.user, req.session.pass);

    try {
        await transporter.sendMail({
            from: `"${req.session.user}" <${req.session.user}>`,
            to: req.body.to,
            subject: req.body.subject,
            html: req.body.message.replace(/\n/g, '<br>')
        });
        res.redirect('/?msg=Email sent successfully! 🚀');
    } catch (err) {
        res.send("Send Error: " + err);
    }
});

app.get('/api/emails', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Chưa đăng nhập!' });

    const boxName = req.query.box || 'INBOX'; // <--- CẢI TIẾN: Mặc định là INBOX, nếu có request thì lấy theo box
    const config = getImapConfig(req.session.user, req.session.pass); // Hàm config cũ của mày

    try {
        const connection = await imaps.connect(config);

        // Mở đúng cái hộp cần mở (INBOX, Sent, Trash...)
        await connection.openBox(boxName);

        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: false,
            struct: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        // Xử lý dữ liệu trả về (Map lại cho đẹp)
        const emails = messages.map(msg => {
            const header = msg.parts.filter(part => part.which === 'HEADER')[0].body;
            return {
                id: msg.attributes.uid,
                from: header.from[0],
                to: header.to ? header.to[0] : 'Unknown', // Lấy thêm To để hiển thị cho mục Sent
                subject: header.subject[0],
                date: header.date[0],
                box: boxName // Trả về để Frontend biết đang ở đâu
            };
        });

        connection.end();
        res.json(emails.reverse()); // Đảo ngược để mail mới nhất lên đầu
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Lỗi lấy mail: ' + err.message });
    }
});

app.listen(9200, () => {
    console.log('🚀 Javalorant Mail v3 (Secure) running at http://localhost:9200');
});