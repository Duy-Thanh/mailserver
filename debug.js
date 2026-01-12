const imaps = require('imap-simple');

const config = {
    imap: {
        user: 'admin@javalorant.xyz',
        password: 'Nekkochan123',  // <--- Pass mới mày vừa đổi
        host: '172.20.0.2',        // <--- IP nội bộ
        port: 143,                 // <--- Port 143
        tls: false,                // <--- TẮT SSL
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    }
};

console.log("Check login user: " + config.imap.user);
console.log("Pass: " + config.imap.password);
console.log("Connecting to " + config.imap.host + ":" + config.imap.port + "...");

imaps.connect(config).then(connection => {
    console.log(">>> KẾT NỐI THÀNH CÔNG! (Pass đúng, Server ngon)");
    return connection.end();
}).catch(err => {
    console.log(">>> KẾT NỐI THẤT BẠI!");
    console.log("Lỗi chi tiết:", err);
});