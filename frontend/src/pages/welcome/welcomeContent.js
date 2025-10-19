async function loadWelcomeContent() {

	return [
		{
			channel_id: "1a",
			content: '/interactivePost1.html',
			created_at: "2025-09-17T10:00:00.000Z",
			downvotes: 0,
			feed_id: "1b",
			is_saved: false,
			parent_id: null,
			post_id: "1c",
			poster: {
				feed_name: "Welcome",
				feed_photo: "/media/site_images/Logo.png"
			},
			poster_id: "1d",
			replies: 25712,
			updated_at: "2025-09-17T10:00:30.000Z",
			upvotes: 42646,
			views: 152356
		},
		{
			channel_id: "2a",
			content: '/interactivePost2.html',
			created_at: "2025-09-17T09:30:00.000Z",
			downvotes: 1,
			feed_id: "2",
			is_saved: false,
			parent_id: null,
			post_id: "2c",
			poster: {
				feed_name: "iLearnLanguages",
				feed_photo: "/media/site_images/welcomeUsers/languageUser.png"
			},
			poster_id: "2d",
			replies: 8346,
			updated_at: "2025-09-17T09:35:15.000Z",
			upvotes: 28364,
			views: 89325
		},
		{
			channel_id: "3a",
			content: '/interactivePost3.html',
			created_at: "2025-09-18T10:00:00.000Z",
			downvotes: 0,
			feed_id: "3b",
			poster: {
				feed_name: "ProGamer99",
				feed_photo: "/media/site_images/welcomeUsers/gamingUser.png"
			},
			is_saved: false,
			parent_id: null,
			post_id: "3c",
			poster_id: "3d",
			replies: 32426,
			updated_at: "2025-09-17T10:00:30.000Z",
			upvotes: 91521,
			views: 712643
		},
		{
			channel_id: "4a",
			content: '/interactivePost4.html',
			created_at: "2025-09-18T09:30:00.000Z",
			downvotes: 3,
			feed_id: "4b",
			poster: {
				feed_name: "Machine Learning Learner",
				feed_photo: "/media/site_images/welcomeUsers/mlUser.png"
			},
			is_saved: false,
			parent_id: null,
			post_id: "4c",
			poster_id: "4d",
			replies: 11576,
			updated_at: "2025-09-17T09:35:15.000Z",
			upvotes: 25355,
			views: 78164
		},
		{
			channel_id: "5a",
			content: '/interactivePost5.html',
			created_at: "2025-09-18T09:30:00.000Z",
			downvotes: 3,
			feed_id: "5b",
			poster: {
				feed_name: "CasualWikipedian",
				feed_photo: "/media/site_images/welcomeUsers/wikiUser.png"
			},
			is_saved: false,
			parent_id: null,
			post_id: "5c",
			poster_id: "5d",
			replies: 12576,
			updated_at: "2025-09-18T09:35:15.000Z",
			upvotes: 22655,
			views: 85464
		},
		//{
			//channel_id: "6a",
			//content: '/interactivePost6.html',
			//created_at: "2025-09-18T10:00:00.000Z",
			//downvotes: 0,
			//feed_id: "6b",
			//poster: {
				//feed_name: "UserAbc123",
				//feed_photo: "/media/site_images/welcomeUsers/socialUser.png"
			//},
			//is_saved: false,
			//parent_id: null,
			//post_id: "6c",
			//poster_id: "6d",
			//replies: 32426,
			//updated_at: "2025-09-17T10:00:30.000Z",
			//upvotes: 82628,
			//views: 217583
		//},
	];
}

async function loadWelcomeAlgorithms() {
	return [
		{
			algorithm_id: '1',
			algorithm_code: '{"chronology":0.9,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":true},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":25,"max":85},"videoLimits":{"min":null,"max":50},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.1,"voteImpact":0.8,"wordBoost":["discussion","debate","opinion","thoughts","perspective","community","conversation","trending"],"wordSuppress":["spam","promotional","advertisement"]}}',
			algorithm_name: 'Trending',
			custom_instruction: 'Show highly engaging discussions. Prioritise posts with active comment threads and community engagement.',
		},
		{
			algorithm_id: '2',
			algorithm_code: '{"chronology":0.8,"contentType":{"images":true,"text":false,"videos":true,"interactive":true,"externalPosts":false,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":null,"max":25},"videoLimits":{"min":5,"max":60},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.4,"voteImpact":0.7,"wordBoost":["viral","trending","quick","tip","hack","wow","amazing","genius","simple","fast"],"wordSuppress":["long","detailed","comprehensive","analysis","study"]}}',
			algorithm_name: 'Shortform',
			custom_instruction: 'Focus on short, highly engaging content under 280 words. Prioritise videos, interactive content, and posts with high viral potential.',
		},
		{
			algorithm_id: '3',
			algorithm_code: '{"chronology":0.2,"contentType":{"images":false,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":true},"variety":0.8,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":70,"max":100},"videoLimits":{"min":null,"max":100},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0,"voteImpact":0.1,"wordBoost":["analysis","comprehensive","detailed","research","study","investigation","deep","thorough","complete"],"wordSuppress":["quick","brief","summary","tldr","short"]}}',
			algorithm_name: 'Longform',
			custom_instruction: 'Prioritise comprehensive, well-researched longform content. Focus on detailed analysis and thorough investigations. Minimal visual distractions.',
		},
		{
			algorithm_id: '4',
			algorithm_code: '{"chronology":0.9,"contentType":{"images":true,"text":true,"videos":true,"interactive":false,"externalPosts":true,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":20,"max":80},"videoLimits":{"min":null,"max":30},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0,"voteImpact":0.3,"wordBoost":["breaking","news","update","urgent","developing","alert","live","happening","latest","confirmed"],"wordSuppress":["rumor","unconfirmed","speculation","allegedly","reportedly"]}}',
			algorithm_name: 'Breaking News',
			custom_instruction: 'Show verified breaking news and current events. Prioritise recent posts with high engagement and visual content. Suppress unconfirmed information.',
		},
		{
			algorithm_id: '5',
			algorithm_code: '{"chronology":0.7,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":false,"embeddedWebsites":true},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":30,"max":75},"videoLimits":{"min":null,"max":80},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.3,"voteImpact":0.2,"wordBoost":["tutorial","learn","how-to","guide","explain","education","course","lesson","teach","step-by-step"],"wordSuppress":["clickbait","drama","gossip","celebrity"]}}',
			algorithm_name: 'Educational Content',
			custom_instruction: 'Focus on educational content with visual aids. Prioritise tutorials, guides, and how-to content with images or interactive elements.',
		},
		{
			algorithm_id: '6',
			algorithm_code: '{"chronology":0.6,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":null,"max":60},"videoLimits":{"min":null,"max":70},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.6,"voteImpact":0.6,"wordBoost":["funny","meme","comedy","entertainment","viral","cute","amazing","hilarious","awesome"],"wordSuppress":["serious","political","depressing","sad","tragic"]}}',
			algorithm_name: 'Entertainment & Fun',
			custom_instruction: 'Show entertaining content with positive sentiment. Prioritize funny, cute, and amazing content while filtering out serious or depressing material.',
		},
		{
			algorithm_id: '7',
			algorithm_code: '{"chronology":0.8,"contentType":{"images":true,"text":true,"videos":true,"interactive":false,"externalPosts":true,"embeddedWebsites":true},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":30,"max":80},"videoLimits":{"min":null,"max":60},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.2,"voteImpact":0.2,"wordBoost":["career","professional","industry","business","networking","leadership","startup","innovation","growth"],"wordSuppress":["personal","casual","meme","funny"]}}',
			algorithm_name: 'Professional Network',
			custom_instruction: 'Focus on professional content. Prioritise career insights, industry news, and business networking content.',
		},
		{
			algorithm_id: '8',
			algorithm_code: '{"chronology":0.8,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":false,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":null,"max":70},"videoLimits":{"min":null,"max":100},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.8,"voteImpact":0.4,"wordBoost":["positive","inspiration","motivation","success","achievement","grateful","happiness","love","blessed","amazing"],"wordSuppress":["negative","problem","crisis","drama","toxic","hate","angry","sad","depressing"]}}',
			algorithm_name: 'Positive Vibes',
			custom_instruction: 'Show only highly positive, uplifting content. Strongly filter out any negative sentiment or toxic content.',
		},
		{
			algorithm_id: '9',
			algorithm_code: '{"chronology":0.9,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":true},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":25,"max":85},"videoLimits":{"min":null,"max":80},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.1,"voteImpact":0.3,"wordBoost":["technology","AI","innovation","startup","coding","software","digital","tech","development","programming"],"wordSuppress":["outdated","legacy","old-school","traditional"]}}',
			algorithm_name: 'Tech & Innovation',
			custom_instruction: 'Focus on cutting-edge technology and innovation. Prioritise AI, software development, and digital innovation.',
		},
		{
			algorithm_id: '10',
			algorithm_code: '{"chronology":0.8,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":10,"max":70},"videoLimits":{"min":null,"max":85},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.3,"voteImpact":0.5,"wordBoost":["sports","fitness","workout","training","athlete","game","team","health","exercise","gym"],"wordSuppress":["injury","controversy","scandal"]}}',
			algorithm_name: 'Sports & Fitness',
			custom_instruction: 'Focus on sports and fitness content with visual elements. Prioritise positive athletic content and workout demonstrations.',
		},
		{
			algorithm_id: '11',
			algorithm_code: '{"chronology":0.5,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":false,"embeddedWebsites":false},"variety":0.9,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":10,"max":60},"videoLimits":{"min":null,"max":75},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.4,"voteImpact":0.3,"wordBoost":["art","creative","design","music","artist","painting","photography","inspiration","culture","aesthetic"],"wordSuppress":["commercial","advertisement","promotion"]}}',
			algorithm_name: 'Creative Arts & Culture',
			custom_instruction: 'Show creative and artistic content. Prioritise original art, design inspiration, and cultural content over commercial posts.',
		},
		{
			algorithm_id: '12',
			algorithm_code: '{"chronology":0.5,"contentType":{"images":true,"text":true,"videos":true,"interactive":true,"externalPosts":true,"embeddedWebsites":true},"variety":0.7,"activeDays":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"textLimits":{"min":40,"max":90},"videoLimits":{"min":null,"max":80},"timeLimits":{"startTime":"00:00","endTime":"23:59"},"dateLimits":{"from":null,"to":null},"scoring":{"sentiment":0.2,"voteImpact":0.3,"wordBoost":["quality","curated","thoughtful","insightful","well-written","informative","valuable"],"wordSuppress":["spam","low-effort","clickbait","rage-bait","toxic"]}}',
			algorithm_name: 'High quality',
			custom_instruction: 'Focus on high-quality, well-crafted content with good engagement. Filter out spam and low-effort posts while prioritising thoughtful, valuable contributions.',
		},
	]
}

export { loadWelcomeAlgorithms, loadWelcomeContent };