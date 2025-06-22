import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

export default function useTimeAgo(date) {
	const [timeAgo, setTimeAgo] = useState(formatDistanceToNow(new Date(date), { addSuffix: true }));
	useEffect(() => {
		const update = () => {
			setTimeAgo(formatDistanceToNow(new Date(date), { addSuffix: true }));
		};
		update();
		const id = setInterval(update, 60000);
		return () => clearInterval(id);
	}, [date]);
	return timeAgo;
}
