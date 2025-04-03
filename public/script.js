import { programs } from './programs.js';

// Populate program dropdown
const programSelect = document.getElementById('program');
programs.forEach(program => {
    const option = document.createElement('option');
    option.value = program.id;
    option.textContent = program.name;
    programSelect.appendChild(option);
});

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registrationForm');
    const submitButton = document.getElementById('submitButton');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                submitButton.disabled = true;
                submitButton.textContent = '처리 중...';
                
                const formData = {
                    name: document.getElementById('name').value,
                    gender: document.querySelector('input[name="gender"]:checked').value,
                    address: document.getElementById('address').value,
                    phone: document.getElementById('phone').value,
                    birthdate: document.getElementById('birthdate').value,
                    livingType: document.getElementById('livingType').value,
                    program: document.getElementById('program').value,
                    privacyAgreement: document.getElementById('privacyAgreement').checked ? 1 : 0
                };

                const response = await fetch('/api/registrations', {
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

                alert('접수가 완료되었습니다.');
                form.reset();
                
            } catch (error) {
                console.error('Registration error:', error);
                alert(error.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = '접수하기';
            }
        });
    }
});