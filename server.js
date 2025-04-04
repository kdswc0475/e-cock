const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// 환경 변수 설정
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

// 서버 URL 설정
const SERVER_URL = NODE_ENV === 'production'
    ? 'https://e-cock.onrender.com'
    : `http://localhost:${PORT}`;

console.log('Environment:', NODE_ENV);
console.log('Port:', PORT);
console.log('Server URL:', SERVER_URL);

const app = express();

// 전역 데이터베이스 객체
let db;

// CORS 설정
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? 'https://e-cock.onrender.com'
        : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'public')));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
});

// Database setup with retry logic
async function connectDatabase(retries = 5) {
    return new Promise((resolve, reject) => {
        const tryConnect = (attempt) => {
            console.log(`Attempting database connection (attempt ${attempt})`);
            
            // 메모리 데이터베이스 사용
            const database = new sqlite3.Database(':memory:', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(`Database connection error (attempt ${attempt}):`, err);
                    if (attempt < retries) {
                        setTimeout(() => tryConnect(attempt + 1), 5000);
                    } else {
                        reject(err);
                    }
                } else {
                    console.log('Connected to in-memory SQLite database');

                    // 테이블 생성
                    database.run(`CREATE TABLE IF NOT EXISTS registrations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        gender TEXT NOT NULL,
                        address TEXT NOT NULL,
                        phone TEXT NOT NULL,
                        birthdate TEXT NOT NULL,
                        livingType TEXT NOT NULL,
                        program TEXT NOT NULL,
                        privacyAgreement INTEGER NOT NULL,
                        registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) {
                            console.error('Error creating table:', err);
                            reject(err);
                        } else {
                            console.log('Table created successfully');
                            resolve(database);
                        }
                    });
                }
            });
        };
        tryConnect(1);
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        serverUrl: SERVER_URL,
        port: PORT
    });
});

// 기본 라우트 핸들러
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 관리자 페이지 라우트
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 데이터 내보내기 엔드포인트
app.get('/export-data', (req, res) => {
    try {
        db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
            if (err) {
                console.error('Error retrieving data:', err);
                return res.status(500).json({ 
                    success: false,
                    message: '데이터 조회 중 오류가 발생했습니다.'
                });
            }

            // 데이터 변환
            const formattedData = rows.map(row => ({
                'ID': row.id,
                '이름': row.name,
                '성별': row.gender === 'male' ? '남성' : '여성',
                '주소': row.address,
                '연락처': row.phone,
                '생년월일': row.birthdate,
                '생활구분': getLivingTypeText(row.livingType),
                '프로그램': getProgramText(row.program),
                '개인정보동의': row.privacyAgreement ? '동의' : '미동의',
                '접수일시': row.registrationDate
            }));

            // JSON 응답 전송
            res.json({
                success: true,
                message: '데이터가 준비되었습니다.',
                data: formattedData
            });
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            success: false,
            message: '데이터 내보내기 중 오류가 발생했습니다.'
        });
    }
});

// 생활구분 텍스트 변환 함수
function getLivingTypeText(type) {
    const types = {
        'general': '일반',
        'basic': '기초생활수급',
        'lowIncome': '차상위',
        'veteran': '국가유공자',
        'other': '기타'
    };
    return types[type] || type;
}

// 프로그램 텍스트 변환 함수
function getProgramText(program) {
    const programs = {
        'ballet': '유아발레교실',
        'kpop-a': '아동K-POP 댄스(A반)',
        'kpop-b': '아동K-POP 댄스(B반)',
        'yoga': '성인요가',
        'diet-dance': '다이어트 댄스',
        'guitar': '성인 통기타',
        'belly-dance': '밸리댄스'
    };
    return programs[program] || program;
}

// API 엔드포인트: 등록 데이터 조회
app.get('/api/registrations', (req, res) => {
    try {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
                console.error('Error fetching registrations:', err);
            return res.status(500).json({ 
                success: false,
                message: '데이터 조회 중 오류가 발생했습니다.',
                error: err.message
            });
        }
        res.json({ 
            success: true,
            data: rows
        });
    });
    } catch (error) {
        console.error('Error in /api/registrations:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// API 엔드포인트: 새로운 등록 데이터 추가
app.post('/api/registrations', async (req, res) => {
    try {
        const { name, gender, address, phone, birthdate, livingType, program, privacyAgreement } = req.body;
        
        db.run(`INSERT INTO registrations (name, gender, address, phone, birthdate, livingType, program, privacyAgreement)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, gender, address, phone, birthdate, livingType, program, privacyAgreement ? 1 : 0],
            function(err) {
                if (err) {
                    console.error('Error inserting registration:', err);
                    return res.status(500).json({
                        success: false,
                        message: '등록 중 오류가 발생했습니다.'
                    });
                }
                
                res.json({
                    success: true,
                    message: '등록이 완료되었습니다.',
                    id: this.lastID
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// GET single registration
app.get('/registrations/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Fetching registration with ID: ${id}`);
    
    db.get('SELECT * FROM registrations WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false, 
                message: '데이터 조회 중 오류가 발생했습니다.',
                error: err.message 
            });
        }
        
        if (!row) {
            console.log(`No registration found with ID: ${id}`);
            return res.status(404).json({ 
                success: false, 
                message: '접수 정보를 찾을 수 없습니다.' 
            });
        }
        
        console.log('Found registration:', row);
        res.json({ 
            success: true, 
            data: row 
        });
    });
});

// PUT endpoint for updating registration
app.put('/registrations/:id', (req, res) => {
    const { id } = req.params;
    const { name, gender, address, phone, birthdate, livingType, program } = req.body;

    if (!name || !gender || !address || !phone || !birthdate || !livingType || !program) {
        return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
    }

    const sql = `
        UPDATE registrations 
        SET name = ?, gender = ?, address = ?, phone = ?, birthdate = ?, livingType = ?, program = ?
        WHERE id = ?
    `;
    
    db.run(sql, [name, gender, address, phone, birthdate, livingType, program, id], function(err) {
        if (err) {
            console.error('Error updating data:', err);
            return res.status(500).json({ success: false, message: '수정 중 오류가 발생했습니다.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: '수정할 접수 정보를 찾을 수 없습니다.' });
        }
        res.json({ success: true, message: '수정이 완료되었습니다.' });
    });
});

// DELETE endpoint for registration
app.delete('/registrations/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM registrations WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting data:', err);
            return res.status(500).json({ success: false, message: '삭제 중 오류가 발생했습니다.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: '삭제할 접수 정보를 찾을 수 없습니다.' });
        }
        res.json({ success: true, message: '삭제가 완료되었습니다.' });
    });
});

// 서버 시작
async function startServer() {
    try {
        db = await connectDatabase();
        console.log('Database connected successfully');
        
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Server URL: ${SERVER_URL}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 