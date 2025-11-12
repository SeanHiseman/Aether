//Ensures only logged in user can access a route
//Probably needs improving
function authenticateCheck(req, res, next) {
    if (!req.session.user_id) {
        return res.status(401).json({ error: 'Not authenticated'});
    }
    req.user = { user_id: req.session.user_id };
    next();
}

export default authenticateCheck;