async function loadWelcomeContent() {
	const [post1, post2] = await Promise.all([
		fetch('/interactivePost1.html').then(r => r.text()),
		fetch('/interactivePost2.html').then(r => r.text())
	]);

	return [
		{
			channel_id: "59a908c2-e904-499e-9107-f6d22b634182",
			content: post1,
			created_at: "2025-09-17T10:00:00.000Z",
			downvotes: 0,
			feed_id: "e8f76404-a0bd-4745-b9ac-e9344fb9b9c2",
			is_saved: false,
			parent_id: null,
			post_id: "83a550b6-e703-45d3-8568-c64615fcd385",
			poster_id: "e8f76404-a0bd-4745-b9ac-e9344fb9b9c2",
			replies: 12,
			updated_at: "2025-09-17T10:00:30.000Z",
			upvotes: 42,
			views: 156
		},
		{
			channel_id: "59a908c2-e904-499e-9107-f6d22b634182",
			content: post2,
			created_at: "2025-09-17T09:30:00.000Z",
			downvotes: 1,
			feed_id: "e8f76404-a0bd-4745-b9ac-e9344fb9b9c2",
			is_saved: false,
			parent_id: null,
			post_id: "94b661c7-f814-56e4-9679-d75726ede496",
			poster_id: "f9g87505-b1ce-5856-ca4d-fa455gc0c0d3",
			replies: 8,
			updated_at: "2025-09-17T09:35:15.000Z",
			upvotes: 28,
			views: 89
		}
	];
}

export { loadWelcomeContent };