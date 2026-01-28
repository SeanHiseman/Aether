export function ua() {
	if (process.env.NODE_ENV === 'production') {
		return 'AetherSocial/1.0 (+https://aethersocial.com)';
	}
	return 'AetherSocialLocal/0.1 (testing on localhost)';
}