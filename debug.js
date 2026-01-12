const imaps = require('imap-simple');

const config = {
    imap: {
        user: 'admin@javalorant.xyz',
        password: 'Nekkochan0x0007@!',
        host: '172.20.0.2', // Giữ nguyên IP nội bộ này
        port: 143,          // <--- ĐỔI SANG 143
        tls: false,         // <--- TẮT SSL
        authTimeout: 10000
    }
};

console.log("Dang ket noi thu den IMAP 143 (No SSL)...");

imaps.connect(config).then(connection => {
    console.log(">>> KẾT NỐI THÀNH CÔNG! (Đường 143 thông thoáng)");
    return connection.end();
}).catch(err => {
    console.log(">>> KẾT NỐI THẤT BẠI!");
    console.log("Lỗi chi tiết:", err);
});