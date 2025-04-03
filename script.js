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
const form = document.getElementById('registrationForm');
const messageElement = document.getElementById('message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 개인정보 동의 확인
    if (!form.privacyAgreement.checked) {
        messageElement.textContent = '개인정보 수집 및 이용에 동의해주세요.';
        messageElement.className = 'error';
        return;
    }
    
    const formData = {
        name: form.name.value,
        gender: form.gender.value,
        address: form.address.value,
        phone: form.phone.value,
        birthdate: form.birthdate.value,
        livingType: form.livingType.value,
        program: form.program.value,
        privacyAgreement: form.privacyAgreement.checked
    };

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            messageElement.textContent = '접수가 성공적으로 완료되었습니다.';
            messageElement.className = 'success';
            form.reset();
        } else {
            messageElement.textContent = data.message || '접수 중 오류가 발생했습니다.';
            messageElement.className = 'error';
        }
    } catch (error) {
        messageElement.textContent = '서버 연결에 실패했습니다. 다시 시도해주세요.';
        messageElement.className = 'error';
    }
});