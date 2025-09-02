import React from 'react';
import axios from 'axios';
import { FaInfoCircle } from 'react-icons/fa';
import { useCallback, useEffect, useRef, useState } from 'react';

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
                <div className="custom-tooltip" style={{ zIndex: 9999 }}>
                    {info}
                </div>
            )}
        </div>
    );
}

const DualRangeSlider = ({ min = 0, max = 100, value = [25, 75], onChange, formatValue = (val) => val }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [activeHandle, setActiveHandle] = useState(null);
    const trackRef = useRef(null);

    const handleMouseDown = useCallback((e, handle) => {
        e.preventDefault();
        setIsDragging(true);
        setActiveHandle(handle);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !activeHandle || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const newValue = Math.round((percentage / 100) * (max - min) + min);
        if (activeHandle === 'min') {
            const newMin = Math.min(newValue, value[1] - 1);
            onChange([newMin, value[1]]);
        } else {
            const newMax = Math.max(newValue, value[0] + 1);
            onChange([value[0], newMax]);
        }
    }, [isDragging, activeHandle, min, max, value, onChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setActiveHandle(null);
    }, []);

    const handleTrackClick = useCallback((e) => {
        if (isDragging) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        const clickValue = Math.round((percentage / 100) * (max - min) + min);
        const minDistance = Math.abs(clickValue - value[0]);
        const maxDistance = Math.abs(clickValue - value[1]);
        if (minDistance < maxDistance) {
            const newMin = Math.min(clickValue, value[1] - 1);
            onChange([newMin, value[1]]);
        } else {
            const newMax = Math.max(clickValue, value[0] + 1);
            onChange([value[0], newMax]);
        }
    }, [isDragging, min, max, value, onChange]);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const minPercent = ((value[0] - min) / (max - min)) * 100;
    const maxPercent = ((value[1] - min) / (max - min)) * 100;

    return (
        <div className="dual-slider">
            <div ref={trackRef} className="dual-slider__track" onClick={handleTrackClick}>
                <div className="dual-slider__range" style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }} />
            </div>
            <div className="dual-slider__handle" style={{ left: `${minPercent}%` }} onMouseDown={(e) => handleMouseDown(e, 'min')} />
            <div className="dual-slider__handle" style={{ left: `${maxPercent}%` }} onMouseDown={(e) => handleMouseDown(e, 'max')} />
            <div className="dual-slider__values">
                <span>{formatValue(value[0], 'min')}</span>
                <span>{formatValue(value[1], 'max')}</span>
            </div>
        </div>
    );
};

const ALGORITHM_TEMPLATES = {
    "breaking_news": {
        name: "Breaking News",
        chronology: "newest",
        sentiment: 0,
        variety: 0.9,
        wordBoost: "breaking,news,update,urgent,developing,alert",
        wordSuppress: "rumor,unconfirmed",
        customInstruction: "Show me the latest breaking news and current events. Prioritize recent, verified news updates and urgent developments. Suppress unconfirmed rumors."
    },
    "educational": {
        name: "Educational Content",
        chronology: "newest",
        sentiment: 0.3,
        variety: 0.9,
        wordBoost: "tutorial,learn,how-to,guide,explain,education,course,lesson",
        wordSuppress: "clickbait,drama",
        customInstruction: "Focus on educational and learning content including tutorials, guides, and explanations. Boost helpful educational material while reducing clickbait and drama."
    },
    "entertainment": {
        name: "Entertainment & Fun",
        chronology: "mixed",
        sentiment: 0.6,
        variety: 0.9,
        wordBoost: "funny,meme,comedy,entertainment,viral,cute,amazing",
        wordSuppress: "serious,political,depressing",
        customInstruction: "Show entertaining and fun content that's light-hearted and positive. Prioritize funny, cute, and amazing content while filtering out serious or depressing material."
    },
    "professional": {
        name: "Professional Network",
        chronology: "newest",
        sentiment: 0.2,
        variety: 0.9,
        wordBoost: "career,professional,industry,business,networking,leadership,startup,innovation",
        wordSuppress: "personal,casual",
        customInstruction: "Focus on professional and career-related content. Show industry insights, business news, networking opportunities, and leadership content. Boost during business hours on weekdays."
    },
    "positive_vibes": {
        name: "Positive Vibes",
        chronology: "newest",
        sentiment: 0.8,
        variety: 0.9,
        wordBoost: "positive,inspiration,motivation,success,achievement,grateful,happiness,love",
        wordSuppress: "negative,problem,crisis,drama,toxic",
        customInstruction: "Show only positive, uplifting, and motivational content. Strongly suppress negative, toxic, or crisis-related content. Focus on inspiration, success stories, and happiness."
    },
    "tech_innovation": {
        name: "Tech & Innovation",
        chronology: "newest",
        sentiment: 0.1,
        variety: 0.9,
        wordBoost: "technology,AI,innovation,startup,coding,software,digital,tech",
        wordSuppress: "outdated,legacy",
        customInstruction: "Focus on the latest technology trends and innovations. Prioritize AI, software development, digital innovation, and startup news. Suppress outdated or legacy technology content."
    },
    "sports_fitness": {
        name: "Sports & Fitness",
        chronology: "newest",
        sentiment: 0.3,
        variety: 0.9,
        wordBoost: "sports,fitness,workout,training,athlete,game,team,health",
        wordSuppress: "",
        customInstruction: "Focus on sports, fitness, and health content. Show sports updates, workout tips, training advice, and athletic content. Boost content especially on weekends for game days."
    },
    "creative_arts": {
        name: "Creative Arts",
        chronology: "mixed",
        sentiment: 0.4,
        variety: 0.9,
        wordBoost: "art,creative,design,music,artist,painting,photography,inspiration",
        wordSuppress: "",
        customInstruction: "Show creative and artistic content including art, design, music, and photography. Prioritize visual content and creative inspiration from artists and designers."
    },
    "deep_focus": {
        name: "Deep Focus",
        chronology: "oldest",
        sentiment: 0,
        variety: 0.9,
        wordBoost: "analysis,research,study,insight,deep,detailed,comprehensive",
        wordSuppress: "quick,brief,summary",
        customInstruction: "Focus on long-form, analytical content perfect for deep reading sessions. Prioritize research, detailed analysis, and comprehensive studies. Suppress quick tips and brief summaries."
    }
};

const AddAlgorithm = ({ algorithms = [], editingAlgorithm = null, locationId, onCreated, onUpdated, setEditingAlgorithm }) => {
    console.log("algorithms:", algorithms);    
    const [activeDays, setActiveDays] = useState({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
    const [advancedChronology, setAdvancedChronology] = useState('');
    const [algorithmCode, setAlgorithmCode] = useState('');
    const [algorithmName, setAlgorithmName] = useState('');
    const [chronology, setChronology] = useState(1);
    const [contentType, setContentType] = useState({ images: true, text: true, videos: true, interactive: true, externalPosts: true, embeddedWebsites: true});
    const [customInstruction, setCustomInstruction] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sentiment, setSentiment] = useState(0);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [specificDate, setSpecificDate] = useState('');
    const [startTime, setStartTime] = useState('00:00');
    const [template, setTemplate] = useState('none');
    const [textRange, setTextRange] = useState([0, 100]);
    const [videoRange, setVideoRange] = useState([0, 100]);
    const [variety, setVariety] = useState(0.5);
    const [voteImpact, setVoteImpact] = useState(0);
    const [wordBoost, setWordBoost] = useState('');
    const [wordSuppress, setWordSuppress] = useState('');

    const logScale = (value, min, max) => {
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        return Math.pow(10, logMin + (value / 100) * (logMax - logMin));
    };

    const submitAlgorithm = async () => {
        try {
            setError(null);
            const nameToUse = algorithmName.trim() || `Algorithm ${algorithms.length + 1}`;
            const duplicate = algorithms.some(
                a => a.algorithm_name.toLowerCase() === nameToUse.toLowerCase() &&
                a.algorithm_id !== editingAlgorithm?.algorithm_id
            );
            if (duplicate) {
                setError("Name taken, please choose another.");
                setTimeout(() => { setError('') }, 5000);
                return;
            }
            setLoading(true);
            const payload = {
                algorithmId: editingAlgorithm?.algorithm_id,
                algorithmName: nameToUse,
                activeDays,
                advancedChronology,
                chronology,
                contentType,
                customInstruction,
                dateFrom,
                dateTo,
                locationId,
                minText: textRange[0],
                maxText: textRange[1],
                minVideo: videoRange[0],
                maxVideo: videoRange[1],
                sentiment,
                specificDate,
                startTime,
                endTime,
                template,
                wordBoost: wordBoost.split(',').map(w => w.trim()).filter(Boolean),
                wordSuppress: wordSuppress.split(',').map(w => w.trim()).filter(Boolean),
                variety,
                voteImpact,
            };
            const { data } = editingAlgorithm
                ? await axios.put('/api/edit_algorithm', payload)
                : await axios.post('/api/create_algorithm', payload);
            if (data.success) {
                const saved = data.updatedAlgorithm || data.newAlgorithm;
                if (editingAlgorithm) {
                    onUpdated && onUpdated(saved);
                } else {
                    setEditingAlgorithm(saved);
                    onCreated && onCreated(saved);
                }
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
        return ['from_date', 'until_date', 'between_dates'].includes(advancedChronology);
    };

    const startCreatingNew = () => {
        setActiveDays({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
        setAdvancedChronology('');
        setAlgorithmCode('');
        setAlgorithmName('');
        setChronology(0.8);
        setContentType({ images: true, text: true, videos: true, interactive: true, externalPosts: true, embeddedWebsites: true });
        setCustomInstruction(''); 
        setDateFrom('');
        setDateTo('');        
        setEditingAlgorithm(null);
        setTextRange([0, 100]);
        setVideoRange([0, 100]);
        setSentiment(0);
        setStartTime('00:00');
        setEndTime('23:59');
        setTemplate('none');
        setWordBoost('');
        setWordSuppress('');
        setSpecificDate('');
        setVariety(0.5);
        setVoteImpact(0);
    }

    const templateChange = (templateKey) => {
        setTemplate(templateKey);
        if (templateKey === 'none') {
            setAdvancedChronology('');
            setChronology(0.8);
            setSentiment(0);
            setVoteImpact(1);
            setWordBoost('');
            setWordSuppress('');
            setVariety(0.5);
            setCustomInstruction('');
            return;
        }
        const templateConfig = ALGORITHM_TEMPLATES[templateKey];
        if (templateConfig) {
            setActiveDays({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
            setChronology(templateConfig.chronology);
            setSentiment(templateConfig.sentiment);
            setVoteImpact(templateConfig.voteImpact);
            setWordBoost(templateConfig.wordBoost);
            setWordSuppress(templateConfig.wordSuppress);
            setVariety(templateConfig.variety);
            setCustomInstruction(templateConfig.customInstruction);
            if (!algorithmName || Object.values(ALGORITHM_TEMPLATES).some(t => t.name === algorithmName)) {
                setAlgorithmName(templateConfig.name);
            }
        }
    };

    useEffect(() => {
        if (editingAlgorithm) {
            const { algorithm_code = '', algorithm_name = '' } = editingAlgorithm;
            let parsedAlgorithmCode = algorithm_code;
            if (typeof algorithm_code === 'string' && algorithm_code) {
                try {
                    parsedAlgorithmCode = JSON.parse(algorithm_code);
                } catch (e) {
                    console.error("Failed to parse algorithm_code:", e);
                    parsedAlgorithmCode = {};
                }
            }
            setActiveDays(parsedAlgorithmCode.activeDays || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true });
            setAlgorithmCode(parsedAlgorithmCode);
            setAlgorithmName(algorithm_name);
            setChronology(parsedAlgorithmCode.chronology || 0.8);
            setContentType(parsedAlgorithmCode.contentType || { images: true, text: true, videos: true, interactive: true, externalPosts: true, embeddedWebsites: true });
            setCustomInstruction(editingAlgorithm.custom_instruction || ''); 
            setSentiment(parsedAlgorithmCode.scoring?.sentiment ?? 0);
            setVoteImpact(parsedAlgorithmCode.scoring?.voteImpact ?? 0);
            setStartTime(parsedAlgorithmCode.startTime || '00:00');
            setEndTime(parsedAlgorithmCode.endTime || '23:59');
            setTemplate(parsedAlgorithmCode.template || 'none');
            setTextRange([parsedAlgorithmCode.minText || 0, parsedAlgorithmCode.maxText || 100]);
            setVideoRange([parsedAlgorithmCode.minVideo || 0, parsedAlgorithmCode.maxVideo || 100]);
            const wordBoostArray = parsedAlgorithmCode.scoring?.wordBoost || [];
            const wordSuppressArray = parsedAlgorithmCode.scoring?.wordSuppress || [];
            const wordBoostWords = wordBoostArray.map(item => item.word).join(',');
            const wordSuppressWords = wordSuppressArray.map(item => item.word).join(',');
            setWordBoost(() => wordBoostWords);
            setWordSuppress(() => wordSuppressWords);
            setDateFrom(parsedAlgorithmCode.dateFrom || '');
            setDateTo(parsedAlgorithmCode.dateTo || '');
            setSpecificDate(parsedAlgorithmCode.specificDate || '');
            setVariety(parsedAlgorithmCode.variety ?? 1);
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
                        type="text"
                        value={algorithmName}
                        onChange={e => setAlgorithmName(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <textarea
                        className="form-textarea"
                        placeholder={customInstruction ? customInstruction : "Describe your algorithm..."}
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
                            <option value="positive_vibes">Positive Vibes</option>
                            <option value="tech_innovation">Tech & Innovation</option>
                            <option value="sports_fitness">Sports & Fitness</option>
                            <option value="creative_arts">Creative Arts</option>
                            <option value="deep_focus">Deep Focus</option>
                        </select>
                    </div>
                </div>
                <button className="button" onClick={() => setShowMoreOptions(!showMoreOptions)} type="button">
                    {showMoreOptions ? 'Fewer Options' : 'More Options'}
                </button>
                <button className="button" onClick={() => setShowAdvancedOptions(!showAdvancedOptions)} type="button">
                    {showAdvancedOptions ? 'Hide Advanced Options' : 'Advanced Options'}
                </button>
                {showMoreOptions && (
                    <>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Chronology</label>
                                    <InfoIconWithTooltip info="Prioritise older or newer posts. Fully newest means pure chronological order." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    value={chronology}
                                    onChange={e => setChronology(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Oldest</span>
                                    <span className="tiny-text">Neutral</span>
                                    <span className="tiny-text">Newest</span>
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
                                    value={voteImpact}
                                    onChange={e => setVoteImpact(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">None</span>
                                    <span className="tiny-text">Mild</span>
                                    <span className="tiny-text">Heavy</span>
                                </div>
                            </div>
                        </div>
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
                                    value={variety}
                                    onChange={e => setVariety(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Random</span>
                                    <span className="tiny-text">Mixed</span>
                                    <span className="tiny-text">Similar</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Boost Words</label>
                                    <InfoIconWithTooltip info="Type words, separated by commas, that you wish to see more of." />
                                </div>
                                <textarea
                                    className="form-textarea"
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
                                <textarea
                                    className="form-textarea"
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
                                    <label className="small-text">Video length (sec)</label>
                                    <InfoIconWithTooltip info="Set minimum and maximum video duration. Set both to 0 for no limit." />
                                </div>
                                <DualRangeSlider
                                    value={videoRange}
                                    onChange={setVideoRange}
                                    formatValue={(val, type) => 
                                        val === 0 && type === 'min' ? 'No min' :
                                        val === 100 && type === 'max' ? 'No max' :
                                        `${Math.round(logScale(val, 1, 3600))} sec`
                                    }
                                />
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Text length (words)</label>
                                    <InfoIconWithTooltip info="Set minimum and maximum text length. Set both to 0 for no limit." />
                                </div>
                                <DualRangeSlider
                                    value={textRange}
                                    onChange={setTextRange}
                                    formatValue={(val, type) => 
                                        val === 0 && type === 'min' ? 'No min' :
                                        val === 100 && type === 'max' ? 'No max' :
                                        `${Math.round(logScale(val, 1, 5000))} words`
                                    }
                                />
                            </div>
                        </div>
                        <div className="form-row border-bottom">
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
                    </>
                )}
                {showAdvancedOptions && (
                    <>
                        <div className="form-row">
                            <div className="form-label-with-info">
                                <label className="small-text">More Content Types</label>
                                <InfoIconWithTooltip info="Allow other websites, and posts from other sites to be embedded in posts." />
                            </div>
                            <div>
                                <label>
                                    <input type="checkbox" checked={contentType.externalPosts} onChange={e => setContentType(prev => ({ ...prev, externalPosts: e.target.checked }))} /> External posts
                                </label>
                                <label>
                                    <input type="checkbox" checked={contentType.embeddedWebsites} onChange={e => setContentType(prev => ({ ...prev, embeddedWebsites: e.target.checked }))} /> Websites
                                </label>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Advanced chronology</label>
                                    <InfoIconWithTooltip info="Controls the date range of posts shown." />
                                </div>
                                <div>
                                    <select
                                        className="form-select"
                                        value={advancedChronology}
                                        onChange={e => setAdvancedChronology(e.target.value)}
                                    >
                                        <option value="">None</option>
                                        <option value="from_date">From Date</option>
                                        <option value="until_date">Until Date</option>
                                        <option value="between_dates">Between Dates</option>
                                    </select>
                                </div>
                                {shouldShowDateInputs() && (
                                    <div className="form-row" style={{ marginTop: '10px' }}>
                                        {(advancedChronology === 'from_date' || advancedChronology === 'between_dates') && (
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
                                        {(advancedChronology === 'until_date' || advancedChronology === 'between_dates') && (
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
                            </div>
                            <div className="form-group" style={{ alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
                                <div className="form-label-with-info">
                                    <label className="small-text">Active Hours</label>
                                    <InfoIconWithTooltip info="This algorithm will only be applied at these times of day." />
                                </div>
                                <div className="time-range-container">
                                    <input 
                                        type="time" 
                                        className="time-input"
                                        value={startTime} 
                                        onChange={e => setStartTime(e.target.value)} 
                                    />
                                    <span className="time-separator">—</span>
                                    <input 
                                        type="time" 
                                        className="time-input"
                                        value={endTime} 
                                        onChange={e => setEndTime(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="form-row" style={{ paddingBottom: '0' }}>
                            <div className="form-label-with-info">
                                <label className="small-text">Specific Days</label>
                                <InfoIconWithTooltip info="Days of the week that the algorithm will apply to." />
                            </div>
                        </div>
                        <div className="form-row">
                            <div>
                                <label>
                                    <input type="checkbox" checked={activeDays.monday} onChange={e => setActiveDays(prev => ({ ...prev, monday: e.target.checked }))} /> Mon
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.tuesday} onChange={e => setActiveDays(prev => ({ ...prev, tuesday: e.target.checked }))} /> Tue
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.wednesday} onChange={e => setActiveDays(prev => ({ ...prev, wednesday: e.target.checked }))} /> Wed
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.thursday} onChange={e => setActiveDays(prev => ({ ...prev, thursday: e.target.checked }))} /> Thur
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.friday} onChange={e => setActiveDays(prev => ({ ...prev, friday: e.target.checked }))} /> Fri
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.saturday} onChange={e => setActiveDays(prev => ({ ...prev, saturday: e.target.checked }))} /> Sat
                                </label>
                                <label>
                                    <input type="checkbox" checked={activeDays.sunday} onChange={e => setActiveDays(prev => ({ ...prev, sunday: e.target.checked }))} /> Sun
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AddAlgorithm;