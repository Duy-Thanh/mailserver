const imaps = require('imap-simple');

const config = {
    imap: {
        user: 'admin@javalorant.xyz',
        password: 'Nekkochan0x0007@!',
        host: '127.0.0.1',  // <--- Về lại nhà
        port: 143,          // Vẫn dùng 143 (Non-SSL)
        tls: false,
        authTimeout: 10000
    }
};

console.log("Dang ket noi thu den 127.0.0.1:143...");

imaps.connect(config).then(connection => {
    console.log(">>> KẾT NỐI THÀNH CÔNG! (Về nhà là nhất)");
    return connection.end();
}).catch(err => {
    console.log(">>> KẾT NỐI THẤT BẠI!");
    console.log("Lỗi chi tiết:", err);
});