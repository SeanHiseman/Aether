import { intervalToDuration } from 'date-fns';
import { useEffect, useState } from 'react';

export default function useTimeAgo(date) {
	const formatShort = (d) => {
		if (!d || isNaN(new Date(d))) return '';
		const duration = intervalToDuration({ start: new Date(d), end: new Date() });
		if (duration.years) return `${duration.years}y`;
		if (duration.months) return `${duration.months}mo`;
		if (duration.days) return `${duration.days}d`;
		if (duration.hours) return `${duration.hours}h`;
		if (duration.minutes) return `${duration.minutes}m`;
		return 'now';
	};

	const [timeAgo, setTimeAgo] = useState(formatShort(date));

	useEffect(() => {
		const update = () => setTimeAgo(formatShort(date));
		update();
		const id = setInterval(update, 60000);
		return () => clearInterval(id);
	}, [date]);

	return timeAgo;
}