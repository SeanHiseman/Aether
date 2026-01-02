import cheerio from 'cheerio';
import natural from 'natural';
import { pipeline } from '@xenova/transformers';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

let embedder = null;
const nlp = winkNLP(model);
const its = nlp.its;

async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

export { getEmbedder };

export class ContentAnalyser {
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

    async extractTextBody(htmlContent) {
        const $ = cheerio.load(htmlContent || '', { decodeEntities: true });
        $('script, style, noscript').remove();
        const textBody = $.text()
            .replace(/\s+/g, ' ')
            .trim();
        return textBody;
    }

    async analyseMedia(htmlContent) {
        const $ = cheerio.load(htmlContent || ''); //Change to detecting text blocks
        const images = $('img').length; //Change to detecting images in media blocks
        const videos = $('video').length; //Change to detecting videos in media blocks
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

    async processText(text) {
        if (!text || text.trim().length === 0) {
            return {
                tokens: [],
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
        return { tokens };
    }

    async generateEmbedding(text) {
        try {
            const embedder = await getEmbedder();
            const output = await embedder(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data); // Convert to plain JS array for storage
        } catch (error) {
            return [];
        }
    }

    async calculateSentiment(text) {
        if (!text || text.trim().length === 0) return 0;
        try {
            const doc = nlp.readDoc(text);
            const rawScore = doc.out(its.sentiment); //between -1 and 1
            //Exponential scaling to push values further from 0
            const weightedScore = Math.sign(rawScore) * Math.pow(Math.abs(rawScore), 0.3); 
            return weightedScore;
        } catch (error) {
            return 0;
        }
    }

    async analyseContent(content, title) {
        const textBody = await this.extractTextBody(content);
        const mediaAnalysis = await this.analyseMedia(content);
        const embedding = await this.generateEmbedding(textBody);
        const textProcessing = await this.processText(textBody);
        const sentimentScore = await this.calculateSentiment(textBody);
        const words = textBody.split(/\s+/).filter(w => w.length > 0);
        const sentences = textBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return {
            text_body: textBody,
            text_length: textBody.length,
            word_count: words.length,
            sentence_count: sentences.length,
            ...mediaAnalysis,
            sentiment_score: sentimentScore,
            tokens: textProcessing.tokens,
            embeddings: embedding,
            processed_at: new Date()
        };
    }
}