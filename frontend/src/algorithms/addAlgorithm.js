import axios from 'axios';
import { FaInfoCircle } from 'react-icons/fa';
import { useEffect, useState } from 'react';

function InfoIconWithTooltip({ info }) {
    const [visible, setVisible] = useState(false);
    return (
        <div
            className="info-icon"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
        >
            <FaInfoCircle />
            {visible && (
                <div className="custom-tooltip">
                    {info}
                </div>
            )}
        </div>
    );
}

const ALGORITHM_TEMPLATES = {
    "breaking_news": {
        name: "Breaking News",
        chronology: "newest",
        strength: 0.8,
        sentiment: 0,
        similarity: 0.6,
        wordBoost: "breaking,news,update,urgent,developing,alert",
        wordSuppress: "rumor,unconfirmed",
        customInstruction: "Show me the latest breaking news and current events. Prioritize recent, verified news updates and urgent developments. Suppress unconfirmed rumors."
    },
    "educational": {
        name: "Educational Content",
        chronology: "newest",
        strength: 0.7,
        sentiment: 0.3,
        similarity: 0.5,
        wordBoost: "tutorial,learn,how-to,guide,explain,education,course,lesson",
        wordSuppress: "clickbait,drama",
        customInstruction: "Focus on educational and learning content including tutorials, guides, and explanations. Boost helpful educational material while reducing clickbait and drama."
    },
    "entertainment": {
        name: "Entertainment & Fun",
        chronology: "mixed",
        strength: 0.4,
        sentiment: 0.6,
        similarity: 0.3,
        wordBoost: "funny,meme,comedy,entertainment,viral,cute,amazing",
        wordSuppress: "serious,political,depressing",
        customInstruction: "Show entertaining and fun content that's light-hearted and positive. Prioritize funny, cute, and amazing content while filtering out serious or depressing material."
    },
    "professional": {
        name: "Professional Network",
        chronology: "newest",
        strength: 0.8,
        sentiment: 0.2,
        similarity: 0.7,
        wordBoost: "career,professional,industry,business,networking,leadership,startup,innovation",
        wordSuppress: "personal,casual",
        customInstruction: "Focus on professional and career-related content. Show industry insights, business news, networking opportunities, and leadership content. Boost during business hours on weekdays."
    },
    "positive_vibes": {
        name: "Positive Vibes Only",
        chronology: "newest",
        strength: 0.6,
        sentiment: 0.8,
        similarity: 0.4,
        wordBoost: "positive,inspiration,motivation,success,achievement,grateful,happiness,love",
        wordSuppress: "negative,problem,crisis,drama,toxic",
        customInstruction: "Show only positive, uplifting, and motivational content. Strongly suppress negative, toxic, or crisis-related content. Focus on inspiration, success stories, and happiness."
    },
    "tech_innovation": {
        name: "Tech & Innovation",
        chronology: "newest",
        strength: 0.7,
        sentiment: 0.1,
        similarity: 0.8,
        wordBoost: "technology,AI,innovation,startup,coding,software,digital,tech",
        wordSuppress: "outdated,legacy",
        customInstruction: "Focus on the latest technology trends and innovations. Prioritize AI, software development, digital innovation, and startup news. Suppress outdated or legacy technology content."
    },
    "local_community": {
        name: "Local Community",
        chronology: "newest",
        strength: 0.6,
        sentiment: 0.2,
        similarity: 0.5,
        wordBoost: "local,community,neighborhood,event,meetup,volunteer,charity",
        wordSuppress: "global,international",
        customInstruction: "Show local community content including neighborhood events, meetups, volunteer opportunities, and local news. Suppress global or international content to focus on local community."
    },
    "sports_fitness": {
        name: "Sports & Fitness",
        chronology: "newest",
        strength: 0.7,
        sentiment: 0.3,
        similarity: 0.8,
        wordBoost: "sports,fitness,workout,training,athlete,game,team,health",
        wordSuppress: "",
        customInstruction: "Focus on sports, fitness, and health content. Show sports updates, workout tips, training advice, and athletic content. Boost content especially on weekends for game days."
    },
    "creative_arts": {
        name: "Creative Arts",
        chronology: "mixed",
        strength: 0.5,
        sentiment: 0.4,
        similarity: 0.6,
        wordBoost: "art,creative,design,music,artist,painting,photography,inspiration",
        wordSuppress: "",
        customInstruction: "Show creative and artistic content including art, design, music, and photography. Prioritize visual content and creative inspiration from artists and designers."
    },
    "deep_focus": {
        name: "Deep Focus",
        chronology: "oldest",
        strength: 0.9,
        sentiment: 0,
        similarity: 0.9,
        wordBoost: "analysis,research,study,insight,deep,detailed,comprehensive",
        wordSuppress: "quick,brief,summary",
        customInstruction: "Focus on long-form, analytical content perfect for deep reading sessions. Prioritize research, detailed analysis, and comprehensive studies. Suppress quick tips and brief summaries."
    }
};

const AddAlgorithm = ({ algorithms = [], editingAlgorithm = null, locationId, onCreated, onUpdated, setEditingAlgorithm }) => {
    console.log("algorithms:", algorithms);    
    const [activeDays, setActiveDays] = useState({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
    const [algorithmCode, setAlgorithmCode] = useState('');
    const [algorithmName, setAlgorithmName] = useState('');
    const [chronology, setChronology] = useState('newest');
    const [contentType, setContentType] = useState({ images: true, text: true, videos: true, interactive: true });
    const [customInstruction, setCustomInstruction] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sentiment, setSentiment] = useState(0);
    const [similarity, setSimilarity] = useState(0);
    const [startTime, setStartTime] = useState('00:00');
    const [strength, setStrength] = useState(0.5);
    const [template, setTemplate] = useState('none');
    const [wordBoost, setWordBoost] = useState('');
    const [wordSuppress, setWordSuppress] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [specificDate, setSpecificDate] = useState('');
    const [showMoreOptions, setShowMoreOptions] = useState(false);

    const submitAlgorithm = async () => {
        try {
            setError(null);
            const nameToUse = algorithmName.trim() || `Algorithm ${algorithms.length + 1}`;
            const duplicate = algorithms.some(
                a => a.algorithm_name.toLowerCase() === nameToUse.toLowerCase() &&
                a.algorithm_id !== editingAlgorithm?.algorithm_id
            );
            if (duplicate) {
                setError("You already have an algorithm with this name");
                setTimeout(() => { setError('') }, 5000);
                return;
            }
            setLoading(true);
            const payload = {
                algorithmId: editingAlgorithm?.algorithm_id,
                algorithmName: nameToUse,
                chronology,
                contentType,
                customInstruction,
                locationId,
                sentiment,
                similarity,
                startTime,
                endTime,
                strength,
                template,
                wordBoost: wordBoost.split(',').map(w => w.trim()).filter(Boolean),
                wordSuppress: wordSuppress.split(',').map(w => w.trim()).filter(Boolean),
                dateFrom,
                dateTo,
                specificDate,
                activeDays
            };
            const { data } = editingAlgorithm
                ? await axios.put('/api/edit_algorithm', payload)
                : await axios.post('/api/create_algorithm', payload);
            if (data.success) {
                const saved = data.updatedAlgorithm || data.newAlgorithm;
                editingAlgorithm ? onUpdated && onUpdated(saved) : onCreated && onCreated(saved);
                setAlgorithmName('');
                setCustomInstruction('');
                setWordBoost('');
                setWordSuppress('');
                setDateFrom('');
                setDateTo('');
                setSpecificDate('');
            } else {
                throw new Error(data.message || 'Failed to save algorithm.');
            }
        } catch (error) {
            setError("Error submitting algorithm");
            setTimeout(() => { setError('') }, 3000);
        } finally {
            setLoading(false);
        }
    };

    const shouldShowDateInputs = () => {
        return ['from_date', 'until_date', 'between_dates'].includes(chronology);
    };

    const startCreatingNew = () => {
        setAlgorithmCode('');
        setAlgorithmName('');
        setChronology('');
        setContentType({ images: true, text: true, videos: true, interactive: true });
        setCustomInstruction(''); 
        setSentiment(0);
        setSimilarity(0);
        setStartTime('00:00');
        setEndTime('23:59');
        setStrength(1);
        setTemplate('none');
        setWordBoost('');
        setWordSuppress('');
        setDateFrom('');
        setDateTo('');
        setSpecificDate('');
        setActiveDays({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
        setEditingAlgorithm(null);
    }

    const templateChange = (templateKey) => {
        setTemplate(templateKey);
        if (templateKey === 'none') {
            setChronology('newest');
            setStrength(0.5);
            setSentiment(0);
            setSimilarity(0);
            setWordBoost('');
            setWordSuppress('');
            setCustomInstruction('');
            return;
        }
        const templateConfig = ALGORITHM_TEMPLATES[templateKey];
        if (templateConfig) {
            setChronology(templateConfig.chronology);
            setStrength(templateConfig.strength);
            setSentiment(templateConfig.sentiment);
            setSimilarity(templateConfig.similarity);
            setWordBoost(templateConfig.wordBoost);
            setWordSuppress(templateConfig.wordSuppress);
            setCustomInstruction(templateConfig.customInstruction);
            if (!algorithmName || Object.values(ALGORITHM_TEMPLATES).some(t => t.name === algorithmName)) {
                setAlgorithmName(templateConfig.name);
            }
        }
    };

    useEffect(() => {
        if (editingAlgorithm) {
            const { algorithm_code = '', algorithm_name = '' } = editingAlgorithm;
            setAlgorithmCode(algorithm_code);
            setAlgorithmName(algorithm_name);
            setChronology(algorithmCode.chronology || 'newest');
            setContentType(algorithmCode.contentType || { images: true, text: true, videos: true, interactive: true });
            setCustomInstruction(editingAlgorithm.custom_instruction || ''); 
            setSentiment(algorithmCode.sentiment ?? 0);
            setSimilarity(algorithmCode.similarity ?? 0);
            setStartTime(algorithmCode.startTime || '00:00');
            setEndTime(algorithmCode.endTime || '23:59');
            setStrength(algorithmCode.strength ?? 1);
            setTemplate(algorithmCode.template || 'none');
            setWordBoost((algorithmCode.wordBoost || []).join(','));
            setWordSuppress((algorithmCode.wordSuppress || []).join(','));
            setDateFrom(algorithmCode.dateFrom || '');
            setDateTo(algorithmCode.dateTo || '');
            setSpecificDate(algorithmCode.specificDate || '');
            setActiveDays(algorithmCode.activeDays || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
        } else {
            startCreatingNew();
        }
    }, [editingAlgorithm]);

    return (
        <div className="create-algorithm">
            <div className="error-state">{error}</div>
            <div className="create-header">
                <p className="medium-text">{editingAlgorithm ? 'Edit Algorithm' : 'Create New Algorithm'}</p>
		        <div>
                    {editingAlgorithm && (
                        <button 
                            className="button button--secondary" 
                            onClick={startCreatingNew} 
                            type="button"
                            style={{ marginRight: '8px' }}
                        >
                            Create New
                        </button>
                    )}
                    <button className="button button--success" onClick={submitAlgorithm} type="button" disabled={loading}>
                        {loading
                            ? editingAlgorithm ? 'Saving...' : 'Creating...'
                            : editingAlgorithm ? 'Save Changes' : 'Create'}
                    </button>
                </div>
            </div>
            <div className="form hide-scrollbar">
                <div className="form-row">
                    <input
                        className="form-input"
                        placeholder="Enter name"
                        required
                        type="text"
                        value={algorithmName}
                        onChange={e => setAlgorithmName(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <textarea
                        className="form-textarea"
                        placeholder={customInstruction ? customInstruction : "Describe your algorithm..."}
                        required
                        type="text"
                        value={customInstruction}
                        onChange={e => setCustomInstruction(e.target.value)}
                    />
                </div>
                <div className="form-row border-bottom">
                    <div className="form-group">
                        <div className="form-label-with-info">
                            <label className="small-text">Template</label>
                            <InfoIconWithTooltip info="Predefined algorithms. Once selected, you can customise further." />
                        </div>
                        <select
                            className="form-select"
                            value={template}
                            onChange={e => templateChange(e.target.value)}
                        >
                            <option value="none">None</option>
                            <option value="breaking_news">Breaking News</option>
                            <option value="educational">Educational Content</option>
                            <option value="entertainment">Entertainment & Fun</option>
                            <option value="professional">Professional Network</option>
                            <option value="positive_vibes">Positive Vibes Only</option>
                            <option value="tech_innovation">Tech & Innovation</option>
                            <option value="local_community">Local Community</option>
                            <option value="sports_fitness">Sports & Fitness</option>
                            <option value="creative_arts">Creative Arts</option>
                            <option value="deep_focus">Deep Focus</option>
                        </select>
                    </div>
                </div>
                <button className="button" onClick={() => setShowMoreOptions(!showMoreOptions)} type="button">
                    {showMoreOptions ? 'Fewer Options' : 'More Options'}
                </button>
                {showMoreOptions && (
                    <>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Chronology</label>
                                    <InfoIconWithTooltip info="Controls the time ordering and date range of posts shown." />
                                </div>
                                <select
                                    className="form-select"
                                    value={chronology}
                                    onChange={e => setChronology(e.target.value)}
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="mixed">Mixed Chronology</option>
                                    <option value="from_date">From Date</option>
                                    <option value="until_date">Until Date</option>
                                    <option value="between_dates">Between Dates</option>
                                </select>
                            </div>
                        </div>
                        {shouldShowDateInputs() && (
                            <div className="form-row">
                                {(chronology === 'from_date' || chronology === 'between_dates') && (
                                    <div className="form-group">
                                        <label className="small-text">From Date</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={dateFrom}
                                            onChange={e => setDateFrom(e.target.value)}
                                        />
                                    </div>
                                )}
                                {(chronology === 'until_date' || chronology === 'between_dates') && (
                                    <div className="form-group">
                                        <label className="small-text">Until Date</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={dateTo}
                                            onChange={e => setDateTo(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Sentiment</label>
                                    <InfoIconWithTooltip info="Controls the emotional tone of content shown." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    value={sentiment}
                                    onChange={e => setSentiment(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Negative</span>
                                    <span className="tiny-text">Neutral</span>
                                    <span className="tiny-text">Positive</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Content Variety</label>
                                    <InfoIconWithTooltip info="Random shows completely varied content, similar shows more consistent content types." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={strength}
                                    onChange={e => setStrength(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Random</span>
                                    <span className="tiny-text">Mixed</span>
                                    <span className="tiny-text">Similar</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-label-with-info">
                                <label className="small-text">Content Types</label>
                                <InfoIconWithTooltip info="Unchecking a box will filter out all forms of that content." />
                            </div>
                            <div>
                                <label>
                                    <input type="checkbox" checked={contentType.images} onChange={e => setContentType(prev => ({ ...prev, images: e.target.checked }))} /> Images
                                </label>
                                <label>
                                    <input type="checkbox" checked={contentType.text} onChange={e => setContentType(prev => ({ ...prev, text: e.target.checked }))} /> Text
                                </label>
                                <label>
                                    <input type="checkbox" checked={contentType.videos} onChange={e => setContentType(prev => ({ ...prev, videos: e.target.checked }))} /> Videos
                                </label>
                                <label>
                                    <input type="checkbox" checked={contentType.interactive} onChange={e => setContentType(prev => ({ ...prev, interactive: e.target.checked }))} /> Interactive
                                </label>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Boost Words</label>
                                    <InfoIconWithTooltip info="Type words, separated by commas, that you wish to see more of." />
                                </div>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={wordBoost}
                                    onChange={e => setWordBoost(e.target.value)}
                                    placeholder="e.g. sports,tech"
                                />
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Suppress Words</label>
                                    <InfoIconWithTooltip info="Type words, separated by commas, that you wish to see less of." />
                                </div>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={wordSuppress}
                                    onChange={e => setWordSuppress(e.target.value)}
                                    placeholder="e.g. politics"
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Active Hours</label>
                                    <InfoIconWithTooltip info="This algorithm will only be applied at these times of day." />
                                </div>
                                <div>
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                    -
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Vote Impact</label>
                                    <InfoIconWithTooltip info="None ignores votes, heavy makes votes strongly influence what you see." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    value={similarity}
                                    onChange={e => setSimilarity(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">None</span>
                                    <span className="tiny-text">Mild</span>
                                    <span className="tiny-text">Heavy</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AddAlgorithm;