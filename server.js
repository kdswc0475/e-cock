const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// 환경 변수 설정
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// Express 앱 생성
const app = express();

// 데이터 디렉토리 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// CORS 설정
app.use(cors());

// JSON 파싱
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'public')));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    const used = process.memoryUsage();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        serverUrl: NODE_ENV === 'production' ? 'https://e-cock.onrender.com' : `http://localhost:${PORT}`,
        port: PORT.toString(),
        database: {
            status: db ? 'connected' : 'disconnected',
            path: dbPath
        },
        memory: {
            heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(used.rss / 1024 / 1024)}MB`
        },
        uptime: `${Math.round(process.uptime())} seconds`,
        files: {
            'index.html': fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? 'exists' : 'missing',
            'admin.html': fs.existsSync(path.join(__dirname, 'public', 'admin.html')) ? 'exists' : 'missing'
        }
    });
});

// 관리자 인증 미들웨어
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ success: false, message: '잘못된 인증 정보입니다.' });
    }
};

// API Routes
// 모든 등록 데이터 조회
app.get('/api/registrations', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching registrations:', err);
            return res.status(500).json({ success: false, message: '데이터를 불러오는데 실패했습니다.' });
        }
        res.json({ success: true, data: rows });
    });
});

// 단일 등록 데이터 조회
app.get('/api/registrations/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM registrations WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching registration:', err);
            return res.status(500).json({ success: false, message: '데이터를 불러오는데 실패했습니다.' });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: '해당 접수를 찾을 수 없습니다.' });
        }
        res.json({ success: true, data: row });
    });
});

// 새 등록 데이터 생성
app.post('/api/registrations', (req, res) => {
    const { name, gender, address, phone, birthdate, livingType, program } = req.body;
    
    if (!name || !gender || !address || !phone || !birthdate || !livingType || !program) {
        return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
    }

    const sql = `INSERT INTO registrations (name, gender, address, phone, birthdate, livingType, program)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, gender, address, phone, birthdate, livingType, program];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error creating registration:', err);
            return res.status(500).json({ success: false, message: '접수 생성에 실패했습니다.' });
        }
        res.json({ success: true, message: '접수가 완료되었습니다.', id: this.lastID });
    });
});

// 등록 데이터 수정
app.put('/api/registrations/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { name, gender, address, phone, birthdate, livingType, program } = req.body;
    
    if (!name || !gender || !address || !phone || !birthdate || !livingType || !program) {
        return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
    }

    const sql = `UPDATE registrations 
                 SET name = ?, gender = ?, address = ?, phone = ?, 
                     birthdate = ?, livingType = ?, program = ?
                 WHERE id = ?`;
    const params = [name, gender, address, phone, birthdate, livingType, program, id];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error updating registration:', err);
            return res.status(500).json({ success: false, message: '접수 수정에 실패했습니다.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: '해당 접수를 찾을 수 없습니다.' });
        }
        res.json({ success: true, message: '접수가 수정되었습니다.' });
    });
});

// 등록 데이터 삭제
app.delete('/api/registrations/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM registrations WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting registration:', err);
            return res.status(500).json({ success: false, message: '접수 삭제에 실패했습니다.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: '해당 접수를 찾을 수 없습니다.' });
        }
        res.json({ success: true, message: '접수가 삭제되었습니다.' });
    });
});

// 데이터 내보내기
app.get('/api/export', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting data:', err);
            return res.status(500).json({ success: false, message: '데이터 내보내기에 실패했습니다.' });
        }
        res.json({ success: true, data: rows });
    });
});

// 기본 경로 리다이렉션
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 데이터베이스 연결
const dbPath = path.join(dataDir, 'registrations.db');
let db;

function connectDatabase() {
    return new Promise((resolve, reject) => {
        console.log('Connecting to database at:', dbPath);
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            console.log('Connected to the SQLite database.');
            
            // 테이블 생성
            db.run(`CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                gender TEXT NOT NULL,
                address TEXT NOT NULL,
                phone TEXT NOT NULL,
                birthdate TEXT NOT NULL,
                livingType TEXT NOT NULL,
                program TEXT NOT NULL,
                registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                    return;
                }
                console.log('Registrations table ready');
                resolve();
            });
        });
    });
}

// 서버 시작
async function startServer() {
    try {
        await connectDatabase();
        app.listen(PORT, () => {
            console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// 종료 처리
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing cleanup...');
    if (db) {
        db.close(() => {
            console.log('Server and database connections closed.');
            process.exit(0);
        });
    } else {
        console.log('Server connections closed.');
        process.exit(0);
    }
});

startServer(); 