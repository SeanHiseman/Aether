function FormatNumber(num) {
	if (!num) return '0';
	return new Intl.NumberFormat('en', { notation: 'compact' }).format(num);
}
export { FormatNumber };