function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    if (!phone) return true; // Phone is optional
    const re = /^[0-9]{10,11}$/;
    return re.test(phone.replace(/[\s\-\.]/g, ''));
}

function calculateAge(dob) {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function generateUserCode() {
    return "SV" + Date.now();
}

module.exports = {
    validateEmail,
    validatePhone,
    calculateAge,
    generateUserCode
};
