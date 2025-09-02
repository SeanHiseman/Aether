import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useState } from 'react';

export default function useTimeAgo(date) {
	const getFormattedTime = (d) => {
		if (!d || isNaN(new Date(d))) {
			return ''; 
		}
		return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
	};
	const [timeAgo, setTimeAgo] = useState(getFormattedTime(date));

	useEffect(() => {
		const update = () => {
			setTimeAgo(getFormattedTime(date));
		};
		update();
		const id = setInterval(update, 60000);
		return () => clearInterval(id);
	}, [date]);

	return timeAgo;
}