const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 서버 URL 설정
const SERVER_URL = process.env.NODE_ENV === 'production'
    ? 'https://e-cock.onrender.com'
    : `http://localhost:${port}`;

console.log('Server URL:', SERVER_URL);

// 전역 데이터베이스 객체
let db;

// CORS 설정
app.use(cors({
    origin: [SERVER_URL, 'https://e-cock.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

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
    const dbPath = process.env.NODE_ENV === 'production' 
        ? path.join(__dirname, 'registrations.db')  // 프로덕션에서도 로컬 경로 사용
        : path.join(__dirname, 'registrations.db');

    return new Promise((resolve, reject) => {
        const tryConnect = (attempt) => {
            console.log(`Attempting database connection (attempt ${attempt})`);
            const database = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(`Database connection error (attempt ${attempt}):`, err);
                    if (attempt < retries) {
                        setTimeout(() => tryConnect(attempt + 1), 5000);
                    } else {
                        reject(err);
                    }
                } else {
                    console.log('Connected to SQLite database at:', dbPath);
                    resolve(database);
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
        environment: process.env.NODE_ENV || 'development',
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString()
    });
});

// Routes with better error handling
app.get('/', (req, res) => {
    try {
        if (!fs.existsSync(path.join(__dirname, 'index.html'))) {
            throw new Error('index.html not found');
        }
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).json({
            success: false,
            message: '페이지를 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

app.get('/admin', (req, res) => {
    try {
        if (!fs.existsSync(path.join(__dirname, 'admin.html'))) {
            throw new Error('admin.html not found');
        }
        res.sendFile(path.join(__dirname, 'admin.html'));
    } catch (error) {
        console.error('Error serving admin.html:', error);
        res.status(500).json({
            success: false,
            message: '관리자 페이지를 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// Excel 생성 엔드포인트
app.get('/export-excel', (req, res) => {
    try {
        const excelDir = path.join(__dirname, 'excel');
        if (!fs.existsSync(excelDir)) {
            fs.mkdirSync(excelDir);
        }

        const fileName = `registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = path.join(excelDir, fileName);

        db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
            if (err) {
                console.error('Error retrieving data for Excel:', err);
                return res.status(500).json({ 
                    success: false,
                    message: '데이터 조회 중 오류가 발생했습니다.'
                });
            }

            // 데이터 변환
            const excelData = rows.map(row => ({
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

            // 워크북 생성
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, '접수현황');

            // 파일 저장
            XLSX.writeFile(wb, filePath);

            res.json({
                success: true,
                message: 'Excel 파일이 생성되었습니다.',
                filePath: filePath
            });
        });
    } catch (error) {
        console.error('Error creating Excel file:', error);
        res.status(500).json({
            success: false,
            message: 'Excel 파일 생성 중 오류가 발생했습니다.'
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

// POST endpoint for registration
app.post('/register', (req, res) => {
    const { name, gender, address, phone, birthdate, livingType, program, privacyAgreement } = req.body;

    if (!name || !gender || !address || !phone || !birthdate || !livingType || !program || privacyAgreement === undefined) {
        return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    }

    const stmt = db.prepare(`
        INSERT INTO registrations (name, gender, address, phone, birthdate, livingType, program, privacyAgreement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(name, gender, address, phone, birthdate, livingType, program, privacyAgreement ? 1 : 0, function(err) {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ message: '데이터 저장 중 오류가 발생했습니다.' });
        }

        res.status(201).json({ 
            message: '접수가 성공적으로 완료되었습니다.',
            id: this.lastID
        });
    });

    stmt.finalize();
});

// GET all registrations
app.get('/registrations', (req, res) => {
    db.all('SELECT * FROM registrations ORDER BY registrationDate DESC', [], (err, rows) => {
        if (err) {
            console.error('Error retrieving data:', err);
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

// Initialize database and start server
async function startServer() {
    try {
        // 데이터베이스 연결
        db = await connectDatabase();
        
        // 테이블 생성
        await new Promise((resolve, reject) => {
            const sql = `CREATE TABLE IF NOT EXISTS registrations (
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
            )`;

            db.run(sql, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                } else {
                    console.log('Table created successfully');
                    resolve();
                }
            });
        });

        // 샘플 데이터 추가
        await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM registrations', [], (err, row) => {
                if (err) {
                    console.error('Error checking table:', err);
                    reject(err);
                    return;
                }
                
                if (row.count === 0) {
                    const sampleData = {
                        name: '홍길동',
                        gender: 'male',
                        address: '서울시 강남구',
                        phone: '010-1234-5678',
                        birthdate: '1990-01-01',
                        livingType: 'general',
                        program: 'yoga',
                        privacyAgreement: 1
                    };

                    const stmt = db.prepare(`
                        INSERT INTO registrations (name, gender, address, phone, birthdate, livingType, program, privacyAgreement)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    stmt.run(
                        sampleData.name,
                        sampleData.gender,
                        sampleData.address,
                        sampleData.phone,
                        sampleData.birthdate,
                        sampleData.livingType,
                        sampleData.program,
                        sampleData.privacyAgreement,
                        (err) => {
                            if (err) {
                                console.error('Error inserting sample data:', err);
                                reject(err);
                            } else {
                                console.log('Sample data added successfully');
                                resolve();
                            }
                        }
                    );
                    stmt.finalize();
                } else {
                    resolve();
                }
            });
        });

        // 서버 시작
        app.listen(port, '0.0.0.0', (err) => {
            if (err) {
                console.error('서버 시작 중 오류 발생:', err);
                process.exit(1);
            }
            console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
        });

    } catch (error) {
        console.error('Server initialization error:', error);
        process.exit(1);
    }
}

// Start the server
startServer().catch(error => {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
}); 