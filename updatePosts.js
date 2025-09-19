import { ContentAnalyser } from './functions/contentAnalyser.js';
import { Posts } from './models/relationships.js';
import sequelize from './databaseSetup.js';

async function randomDateWithin24h() {
    const now = new Date();
    const offset = Math.floor(Math.random() * 12 * 60 * 60 * 1000); 
    return new Date(now.getTime() - offset);
}

async function runAnalysis() {
    const analyser = new ContentAnalyser();
    try {
        const posts = await Posts.findAll();

        for (const post of posts) {
            const analysis = await analyser.analyseContent(post.content, post.title);
            const randomCreatedAt = await randomDateWithin24h();

            await Posts.update(
                {
                    ...analysis,
                    //created_at: randomCreatedAt,
                    updated_at: new Date()
                },
                { where: { post_id: post.post_id } }
            );

            console.log(`Updated post ${post.post_id}`);
        }
        console.log('All posts processed');
    } catch (err) {
        console.error('Error running content analysis:', err);
    } finally {
        await sequelize.close();
    }
}

runAnalysis();