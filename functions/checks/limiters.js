import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,  //5 minutes
    max: 60,                  //60 attempts
    message: 'Too many attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const resendLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, //5 minutes
    max: 30,                 //30 resends
    message: 'Too many requests. Please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const standardLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,  //5 minutes
    max: 300,                 //60 requests per minute
    message: 'Too many requests. Please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const higherLimiter = rateLimit({ //For more repetitive actions
    windowMs: 5 * 60 * 1000,  //5 minutes
    max: 900,                 //180 requests per minute
    message: 'Too many requests. Please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

export { loginLimiter, resendLimiter, standardLimiter, higherLimiter };