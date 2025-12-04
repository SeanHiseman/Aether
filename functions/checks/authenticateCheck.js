import { Users } from '../../models/relationships.js';

//Ensures only logged in user can access a route, and updates last activity
function authenticateCheck(req, res, next) {
	if (!req.session.user_id) {
		return res.status(401).json({ error: 'Not authenticated'});
	}
	req.user = { user_id: req.session.user_id };
	const now = new Date();
	const last = req.session.last_active_at;
	if (!last || now - new Date(last) > 600000) { //10 minutes
		req.session.last_active_at = now;
		Users.update(
			{ last_active_at: now },
			{ where: { user_id: req.session.user_id } }
		);
	}
	next();
}

export default authenticateCheck;