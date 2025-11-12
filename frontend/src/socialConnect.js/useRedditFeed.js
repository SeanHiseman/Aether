import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useRedditFeed() {
	const [after, setAfter] = useState(null);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const inflight = useRef(false);

	const load = useCallback(async () => {
		if (inflight.current || done) return;
		inflight.current = true;
		setLoading(true);
		const qs = new URLSearchParams();
		qs.set('limit', '100');
		if (after) qs.set('after', after);
		try { 
            const response = await axios.get(`/api/reddit/feed?${qs.toString}`, {
                withCredentials: true
            });
            setItems(prev => prev.concat(response.data.items || []));
            setAfter(response.data.after);
            setDone(!response.data.after);
		} catch (error) {
			console.error('Reddit feed error:', error);
		} finally {
			setLoading(false);
			inflight.current = false;
		}
	}, [after, done]);

	useEffect(() => { if (!items.length) load(); }, []); // initial load

	return { items, loading, load, done };
}