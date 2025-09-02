import cheerio from 'cheerio';
import natural from 'natural';
import Sentiment from 'sentiment';

class ContentAnalyser {
    constructor() {
        this.stemmer = natural.PorterStemmer;
        this.tokenizer = new natural.WordTokenizer();
        this.stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
            'had', 'what', 'said', 'each', 'which', 'she', 'do', 'how', 'their'
        ]);
    }

    extractTextBody(htmlContent) {
        const $ = cheerio.load(htmlContent || '', { decodeEntities: true });
        $('script, style, noscript').remove();
        const textBody = $.text()
            .replace(/\s+/g, ' ')
            .trim();
        return textBody;
    }

    analyseMedia(htmlContent) {
        const $ = cheerio.load(htmlContent || '');
        const images = $('img').length;
        const videos = $('video').length;
        const interactive = $('.content-block.code-block, .content-block.app-block, pre, iframe, canvas').length;
        let totalVideoLength = 0;
        $('video').each((_, el) => {
            const durationAttr = $(el).attr('data-duration');
            if (durationAttr) {
                const duration = parseFloat(durationAttr);
                if (!isNaN(duration)) {
                    totalVideoLength += duration;
                }
            }
        });
        return {
            has_images: images > 0,
            has_videos: videos > 0,
            has_interactive: interactive > 0,
            image_count: images,
            video_count: videos,
            video_length: totalVideoLength,
            has_text: $.text().trim().length > 0
        };
    }

    processText(text) {
        if (!text || text.trim().length === 0) {
            return {
                tokens: [],
                bigrams: [],
                trigrams: [],
                keywords: []
            };
        }
        const rawTokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
        const tokens = rawTokens
            .filter(token =>
                token.length >= 2 && //1 character tokens are likely noise
                token.length <= 50 && //50 character tokens are likely to be errors
                !this.stopWords.has(token) &&
                !/^\d+$/.test(token)
            )
            .map(token => this.stemmer.stem(token));
        const bigrams = this.generateNgrams(tokens, 2);
        const trigrams = this.generateNgrams(tokens, 3);
        const keywords = this.extractKeywords(tokens);
        return { tokens, bigrams, trigrams, keywords };
    }

    generateNgrams(tokens, n) {
        if (tokens.length < n) return [];
        const ngrams = [];
        for (let i = 0; i <= tokens.length - n; i++) {
            ngrams.push(tokens.slice(i, i + n).join('_'));
        }
        return ngrams;
    }

    extractKeywords(tokens) {
        const termFreq = this.calculateTermFrequencies(tokens);
        const keywords = Object.entries(termFreq)
            .filter(([word, freq]) => freq > 0.02 && word.length > 3) //at least 2% frequency
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
        return keywords;
    }

    calculateTermFrequencies(tokens) {
        if (!tokens || tokens.length === 0) {
            return {};
        }
        const freq = {};
        const totalTokens = tokens.length;
        tokens.forEach(token => {
            freq[token] = (freq[token] || 0) + 1;
        });
        Object.keys(freq).forEach(term => {
            freq[term] = freq[term] / totalTokens;
        });
        return freq;
    }

    calculateSentiment(tokens) {
        if (!tokens || tokens.length === 0) return 0;
        try {
            const sentiment = new Sentiment();
            const result = sentiment.analyze(tokens.join(' '));
            return Math.max(-1, Math.min(1, Math.tanh(result.score))); //tanh normalisation to between -1 and 1
        } catch (error) {
            console.warn('Sentiment analysis failed:', error);
            return 0;
        }
    }

    //What does a feature hash do?
    generateFeatureHash(content, title) {
        const combined = `${title || ''}|||${content}`;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    analyseContent(content, title) {
        const textBody = this.extractTextBody(content);
        const mediaAnalysis = this.analyseMedia(content);
        const textProcessing = this.processText(textBody);
        const sentimentScore = this.calculateSentiment(textProcessing.tokens);
        const words = textBody.split(/\s+/).filter(w => w.length > 0);
        const sentences = textBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return {
            text_body: textBody,
            text_length: textBody.length,
            word_count: words.length,
            sentence_count: sentences.length,
            ...mediaAnalysis,
            tokens: JSON.stringify(textProcessing.tokens),
            bigrams: JSON.stringify(textProcessing.bigrams),
            trigrams: JSON.stringify(textProcessing.trigrams),
            keywords: JSON.stringify(textProcessing.keywords),
            sentiment_score: sentimentScore,
            term_frequencies: JSON.stringify(this.calculateTermFrequencies(textProcessing.tokens)),
            feature_hash: this.generateFeatureHash(content, title),
            processed_at: new Date()
        };
    }
}

module.exports = ContentAnalyser;