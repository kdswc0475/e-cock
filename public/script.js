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
const API_BASE_URL = window.BASE_URL || '';

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // 프로그램 목록 로드
    const programSelect = document.getElementById('program');
    if (programSelect) {
        console.log('Program select found');
        
        // 기존 옵션 제거 (첫 번째 옵션인 "선택하세요"는 유지)
        while (programSelect.options.length > 1) {
            programSelect.remove(1);
        }
        
        // 프로그램 목록 추가
        programs.forEach(program => {
            const option = document.createElement('option');
            option.value = program;
            option.textContent = program;
            programSelect.appendChild(option);
        });
        
        console.log('Program options loaded:', programSelect.options.length);
    } else {
        console.error('Program select element not found');
    }
    
    // 폼 초기화
    initializeForm();
});

// 폼 초기화 함수
function initializeForm() {
    const form = document.getElementById('registrationForm');
    const submitButton = document.getElementById('submitButton');
    const messageElement = document.getElementById('message');
    
    console.log('Form elements:', { form, submitButton, messageElement });
    
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

                console.log('Form data:', formData);

                const response = await fetch(`${API_BASE_URL}/api/registrations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
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