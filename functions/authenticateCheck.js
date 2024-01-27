//Redirects user to login if not logged in
function authenticateCheck(req, res, next) {
    if (!req.session.user_id) {
        return res.redirect('/login');
    }
    next();
}

export default authenticateCheck;