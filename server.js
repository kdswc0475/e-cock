const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: err.message
    });
});

// Routes
app.get('/', (req, res) => {
    try {
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

// Database setup
const dbPath = process.env.DATABASE_URL || 'registrations.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
    createTable();
});

// Create registrations table
function createTable() {
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
            process.exit(1);
        }
        console.log('Registrations table created or already exists');
        addSampleData();
    });
}

// 샘플 데이터 추가
function addSampleData() {
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

    db.get('SELECT COUNT(*) as count FROM registrations', (err, row) => {
        if (err) {
            console.error('Error checking table:', err);
            return;
        }
        
        if (row.count === 0) {
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
                sampleData.privacyAgreement
            );
            
            stmt.finalize();
            console.log('Sample data added');
        }
    });
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

// Start server with error handling
app.listen(port, '0.0.0.0', (err) => {
    if (err) {
        console.error('서버 시작 중 오류 발생:', err);
        process.exit(1);
    }
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 