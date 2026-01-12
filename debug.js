const imaps = require('imap-simple');

const config = {
    imap: {
        user: 'admin@javalorant.xyz',
        password: 'Nekkochan0x0007@!',
        host: 'localhost',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    }
};

console.log("Dang ket noi thu den IMAP 993...");

imaps.connect(config).then(connection => {
    console.log(">>> KẾT NỐI THÀNH CÔNG! (Pass đúng, Server ngon)");
    return connection.end();
}).catch(err => {
    console.log(">>> KẾT NỐI THẤT BẠI!");
    console.log("Lỗi chi tiết:", err);
});