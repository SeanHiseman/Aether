export function formatNoteLinks(text) {
    //Split on "Sources:" heading
    const sourcesMatch = text.match(/\n?\s*Sources:\s*\n/i);
    if (!sourcesMatch) return linkify(text);

    const splitIndex = text.indexOf(sourcesMatch[0]);
    const body = text.substring(0, splitIndex);
    const sourcesRaw = text.substring(splitIndex + sourcesMatch[0].length);

    //Parse each source line into a styled link
    const sourceLines = sourcesRaw
        .split('\n')
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(line => line.length > 0)
        .map(line => {
            //Markdown link: [text](url)
            const mdMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
            if (mdMatch) {
                return `<a class="ask-note-link" href="${mdMatch[2]}" target="_blank" rel="noopener noreferrer">${mdMatch[1]}</a>`;
            }
            //Plain URL
            const urlMatch = line.match(/^(https?:\/\/[^\s]+)$/);
            if (urlMatch) {
                return `<a class="ask-note-link" href="${urlMatch[1]}" target="_blank" rel="noopener noreferrer">${urlMatch[1]}</a>`;
            }
            //Text with an inline URL
            return linkify(line);
        });

    return `${linkify(body)}<div class="ask-note-sources"><span class="ask-note-sources-label">Sources</span>${sourceLines.join('')}</div>`;
}

function linkify(str) {
    return str
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="ask-note-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a class="ask-note-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
