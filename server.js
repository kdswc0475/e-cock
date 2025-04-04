const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// 환경 변수 설정
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

// Express 앱 생성
const app = express();

// 데이터 디렉토리 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// CORS 설정
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? 'https://e-cock.onrender.com'
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 미들웨어 설정
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 서빙 설정
app.use(express.static(path.join(__dirname, 'public')));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', environment: NODE_ENV });
});

// API Routes
// 모든 등록 데이터 조회
app.get('/api/registrations', (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching registrations:', err);
            return res.status(500).json({ success: false, message: '데이터를 불러오는데 실패했습니다.' });
        }
        res.json({ success: true, data: rows });
    });
});

// 단일 등록 데이터 조회
app.get('/api/registrations/:id', (req, res) => {
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
app.put('/api/registrations/:id', (req, res) => {
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
app.delete('/api/registrations/:id', (req, res) => {
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
app.get('/api/export', (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting data:', err);
            return res.status(500).json({ success: false, message: '데이터 내보내기에 실패했습니다.' });
        }
        res.json({ success: true, data: rows });
    });
});

// 데이터베이스 연결
const dbPath = path.join(dataDir, 'registrations.db');
let db;

function connectDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
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

// 서버 시작 함수
async function startServer() {
    try {
        await connectDatabase();
        
        const server = app.listen(PORT, () => {
            console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
        });

        // 정상적인 종료 처리
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM. Performing cleanup...');
            server.close(() => {
                db.close(() => {
                    console.log('Server and database connections closed.');
                    process.exit(0);
                });
            });
        });

        // 예기치 않은 에러 처리
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
            server.close(() => {
                db.close(() => {
                    console.log('Server and database connections closed due to error.');
                    process.exit(1);
                });
            });
        });

        // 프로세스 종료 처리
        process.on('exit', (code) => {
            console.log(`Process exit with code: ${code}`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 