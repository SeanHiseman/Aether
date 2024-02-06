//Redirects user to login if not logged in
function authenticateCheck(req, res, next) {
    if (!req.session.user_id) {
        return res.status(401).json({ error: 'Not authenticated'});
    }
    next();
}

export default authenticateCheck;