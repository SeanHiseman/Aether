function ValidateEmail(email, minLength = 1, maxLength = 320) {
    if (typeof email !== 'string') {
        return { valid: false, error: 'Email must be a string.' };
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail.length < minLength) {
        return { valid: false, error: `Email must be at least ${minLength} characters.` };
    }
    if (trimmedEmail.length > maxLength) {
        return { valid: false, error: `Email must be no more than ${maxLength} characters.` };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        return { valid: false, error: 'Email format is invalid.' };
    }
    return { valid: true, error: null };
}

export { ValidateEmail };