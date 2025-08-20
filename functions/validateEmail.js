//Duplicate of frontend function
function ValidateEmail(email, minLength = 0, maxLength = 320) {
    if (typeof email !== 'string') {
        return { valid: false, error: 'Email must be a string.' };
    }
    if (email.length < minLength) {
        return { valid: false, error: `Email must be at least ${minLength} characters.` };
    }
    if (email.length > maxLength) {
        return { valid: false, error: `Email must be no more than ${maxLength} characters.` };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Email format is invalid.' };
    }
    return { valid: true, error: null };
}

export { ValidateEmail };