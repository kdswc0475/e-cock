// 프로그램 목록 정의
const programs = [
    { id: 1, name: '노인 복지 프로그램' },
    { id: 2, name: '장애인 복지 프로그램' },
    { id: 3, name: '아동 복지 프로그램' },
    { id: 4, name: '청소년 복지 프로그램' },
    { id: 5, name: '가족 복지 프로그램' }
];

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const submitButton = document.getElementById('submitButton');
    const messageElement = document.getElementById('message');
    const programSelect = document.getElementById('program');
    
    // 프로그램 목록 로드
    if (programSelect) {
        programs.forEach(program => {
            const option = document.createElement('option');
            option.value = program.id;
            option.textContent = program.name;
            programSelect.appendChild(option);
        });
    }
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                submitButton.disabled = true;
                submitButton.textContent = '처리 중...';
                
                const formData = {
                    name: document.getElementById('name').value,
                    gender: document.querySelector('select[name="gender"]').value,
                    address: document.getElementById('address').value,
                    phone: document.getElementById('phone').value,
                    birthdate: document.getElementById('birthdate').value,
                    livingType: document.getElementById('livingType').value,
                    program: document.getElementById('program').value,
                    privacyAgreement: document.getElementById('privacyAgreement').checked ? 1 : 0
                };

                // API 엔드포인트 URL 설정
                const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:3000/api/registrations'
                    : 'https://e-cock.onrender.com/api/registrations';

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || '등록 중 오류가 발생했습니다.');
                }

                messageElement.textContent = '접수가 완료되었습니다.';
                messageElement.className = 'success';
                form.reset();
                
            } catch (error) {
                console.error('Registration error:', error);
                messageElement.textContent = error.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
                messageElement.className = 'error';
                
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = '접수하기';
            }
        });
    }
});