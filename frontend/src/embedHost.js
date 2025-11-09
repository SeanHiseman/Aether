export const ALLOWED_EMBED_HOSTS = [
	'youtube.com', 'youtu.be', 'youtube-nocookie.com', 'player.vimeo.com',
	'twitter.com', 'x.com', 'platform.twitter.com',
	'instagram.com', 'platform.instagram.com',
	'facebook.com', 'connect.facebook.net',
	'tiktok.com', 'vm.tiktok.com',
	'linkedin.com', 'platform.linkedin.com',
	'threads.net', 'mastodon.social',
	'bsky.app', 'bsky.social',
	'reddit.com', 'redditmedia.com',
	'twitch.tv', 'clips.twitch.tv', 'soundcloud.com',
	'bandcamp.com', 'open.spotify.com',
	'kick.com', 'rumble.com', 'dailymotion.com',
	'medium.com', 'substack.com', 'wordpress.com',
	'blogspot.com', 'deviantart.com', 'artstation.com',
	'imgur.com', 'giphy.com', 'tenor.com',
	'slideshare.net', 'canva.com', 'figma.com',
	'codesandbox.io', 'jsfiddle.net', 'pinterest.com'
];

export const ALLOWED_SCRIPTS = [
	'https://platform.twitter.com/widgets.js',
	'https://www.instagram.com/embed.js',
	'https://platform.instagram.com/en_US/embeds.js',
	'https://www.tiktok.com/embed.js',
	'https://embed.reddit.com/widgets.js',
	'https://player.vimeo.com/api/player.js',
	'https://www.youtube.com/iframe_api',
	'https://connect.facebook.net/en_US/sdk.js',
	'https://www.facebook.com/plugins/post.js',
	'https://www.facebook.com/plugins/video.php',
	'https://www.facebook.com/plugins/page.php',
	'https://embed.twitch.tv/embed/v1.js',
	'https://w.soundcloud.com/player/api.js',
	'https://open.spotify.com/embed/',
	'https://codesandbox.io/static/js/sandbox-embed.js',
	'https://assets.codepen.io/assets/embed/ei.js',
	'https://rumble.com/embedJS/u3.js',
	'https://bsky.app/static/embed.js',
	'https://mastodon.social/embed.js',
	'https://threads.net/embed.js',
	'https://platform.linkedin.com/in.js'
];

export const SAFE_UTILITY_HOSTS = [
	'w3.org',                  // SVG and XML namespaces
	'w3schools.com',           // harmless educational references
	'schema.org',              // structured metadata
	'creativecommons.org',     // license badges
	'example.com',             // official placeholder domains
	'static.xx.fbcdn.net',     // used in some Facebook embeds
	'cdninstagram.com',        // image CDN for Instagram embeds
	'scontent.cdninstagram.com', // alt Instagram CDN path
	'pbs.twimg.com',           // Twitter image CDN
	'video.twimg.com',         // Twitter video CDN
	'cdn.embedly.com',         // common intermediary for embeds
	'graph.facebook.com'       // metadata calls from FB embeds
];