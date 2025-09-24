function ChunkFeeds(feeds, number) {
	const results = [];
	for (let i = 0; i < feeds.length; i += number) {
		results.push(feeds.slice(i, i + number));
	}
	return results;
}

export { ChunkFeeds };