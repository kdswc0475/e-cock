// 프로그램 목록
const programs = [
    '유아발레교실',
    '아동K-POP 댄스(A반)',
    '아동K-POP 댄스(B반)',
    '성인요가',
    '다이어트 댄스',
    '성인 통기타',
    '밸리댄스'
];

// API 기본 URL 설정
const API_BASE_URL = window.location.origin;

// 프로그램 목록 로드 함수
function loadProgramList() {
    console.log('Loading program list...');
    const programSelect = document.getElementById('program');
    
    if (!programSelect) {
        console.error('Program select element not found!');
        return;
    }
    
    console.log('Before clearing - Options count:', programSelect.options.length);
    
    // 기존 옵션 모두 제거
    programSelect.innerHTML = '';
    
    // "선택하세요" 옵션 추가
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '선택하세요';
    programSelect.appendChild(defaultOption);
    
    // 프로그램 목록 추가
    programs.forEach(program => {
        const option = document.createElement('option');
        option.value = program;
        option.textContent = program;
        programSelect.appendChild(option);
        console.log('Added program:', program);
    });
    
    console.log('After loading - Options count:', programSelect.options.length);
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    loadProgramList();
    initializeForm();
});

// 폼 초기화 함수
function initializeForm() {
    const form = document.getElementById('registrationForm');
    const submitButton = document.getElementById('submitButton');
    const messageElement = document.getElementById('message');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                submitButton.disabled = true;
                submitButton.textContent = '처리 중...';
                
                const formData = {
                    name: document.getElementById('name').value,
                    gender: document.getElementById('gender').value,
                    address: document.getElementById('address').value,
                    phone: document.getElementById('phone').value,
                    birthdate: document.getElementById('birthdate').value,
                    livingType: document.getElementById('livingType').value,
                    program: document.getElementById('program').value
                };

                console.log('Submitting form data:', formData);

                const response = await fetch(`${API_BASE_URL}/api/registrations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                console.log('API response:', result);
                
                if (result.success) {
                    messageElement.textContent = '접수가 완료되었습니다.';
                    messageElement.className = 'success';
                    form.reset();
                } else {
                    messageElement.textContent = result.message || '접수 중 오류가 발생했습니다.';
                    messageElement.className = 'error';
                }
                
            } catch (error) {
                console.error('Registration error:', error);
                messageElement.textContent = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
                messageElement.className = 'error';
                
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = '접수하기';
            }
        });
    }
}