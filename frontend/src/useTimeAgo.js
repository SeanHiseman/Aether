import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useState } from 'react';

export default function useTimeAgo(date) {
	const [timeAgo, setTimeAgo] = useState(formatDistanceToNowStrict(new Date(date), { addSuffix: true }));
	useEffect(() => {
		const update = () => {
			setTimeAgo(formatDistanceToNowStrict(new Date(date), { addSuffix: true }));
		};
		update();
		const id = setInterval(update, 60000);
		return () => clearInterval(id);
	}, [date]);
	return timeAgo;
}
