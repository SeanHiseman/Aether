import { ALGORITHM_TEMPLATES } from './algorithmTemplates';
import api from '../api';
import { AuthContext } from '../components/authContext';
import { DualRangeSlider } from './dualRangeSlider';
import { InfoIconWithTooltip } from './infoIconWithTooltip';
import { useContext, useEffect, useState } from 'react';
import { ValidateTextInput } from '../functions/validateTextInput';

const AddAlgorithm = ({ algorithms = [], display, editingAlgorithm = null, isAuthenticated, locationId, onCreated, onUpdated, setEditingAlgorithm }) => {  
    const authContext = useContext(AuthContext);
	const { user = null } = authContext || {};
    const [activeDays, setActiveDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    const [algorithmCode, setAlgorithmCode] = useState('');
    const [algorithmName, setAlgorithmName] = useState('');
    const [chronology, setChronology] = useState(0);
    const [contentType, setContentType] = useState({ images: true, text: true, videos: true, interactive: true });
    const [customInstruction, setCustomInstruction] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [error, setError] = useState(null);
    const [generateCode, setGenerateCode] = useState(false); //Tells backend if LLM should be used to generate JSON
    const [loading, setLoading] = useState(false);
    const [sentiment, setSentiment] = useState(0);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [startTime, setStartTime] = useState('00:00');
    const [template, setTemplate] = useState('none');
    const [videoRange, setVideoRange] = useState([0, 100]);
    const [variety, setVariety] = useState(0);
    const [voteImpact, setVoteImpact] = useState(0);
    const [wordBoost, setWordBoost] = useState('');
    const [wordRange, setWordRange] = useState([0, 100]);
    const [wordSuppress, setWordSuppress] = useState('');

    const [learningRate, setLearningRate] = useState(0.5);
    const [interactionWeights, setInteractionWeights] = useState({ upvotes: 0.3, comments: 0.25, shares: 0.2, saves: 0.15, viewDuration: 0.1 });
    const [authorDiversity, setAuthorDiversity] = useState(0.5);
    const [controversyScore, setControversyScore] = useState(0);
    const [accountSizePreference, setAccountSizePreference] = useState(0.5);
    const [sourceDiversity, setSourceDiversity] = useState(0.5);

    const hasMembership = user?.has_membership;

    const isDayActive = (day) => activeDays.includes(day);

    const logScale = (value, min, max) => {
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        return Math.pow(10, logMin + (value / 100) * (logMax - logMin));
    };

    const inverseLogScale = (value, min, max) => {
        const logMin = Math.log10(min);
        const logMax = Math.log10(max);
        return ((Math.log10(value) - logMin) / (logMax - logMin)) * 100;
    };

    const submitAlgorithm = async () => {
        if (display) return;
        try {
            setError(null);
            const nameToUse = algorithmName.trim() || `Algorithm ${algorithms.length + 1}`;
            const duplicate = algorithms.some(
                a => a?.algorithm_name.toLowerCase() === nameToUse.toLowerCase() &&
                a?.algorithm_id !== editingAlgorithm?.algorithm_id
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
                chronology,
                contentType,
                customInstruction,
                generateCode,
                locationId,
                minWords: wordRange[0] === 0 ? null : Math.round(logScale(wordRange[0], 1, 5000)),
                maxWords: wordRange[1] >= 100 ? null : Math.round(logScale(wordRange[1], 1, 5000)),
                minVideo: videoRange[0] === 0 ? null : Math.round(logScale(videoRange[0], 5, 3600)),
                maxVideo: videoRange[1] >= 100 ? null : Math.round(logScale(videoRange[1], 5, 3600)),
                sentiment,
                startTime,
                endTime,
                variety,
                voteImpact,
                wordBoost: wordBoost.split(',').map(w => w.trim()).filter(Boolean),
                wordSuppress: wordSuppress.split(',').map(w => w.trim()).filter(Boolean),

                learningRate,
                interactionWeights,
                authorDiversity,
                controversyScore,
                accountSizePreference,
                sourceDiversity,
            };
            const { data } = await api.post('/create_algorithm', payload);
            if (data.success) {
                const saved = data?.algorithm;
            if (editingAlgorithm) {
                const wasNameOnlyChange = 
                    editingAlgorithm.algorithm_name !== algorithmName &&
                    editingAlgorithm.algorithm_code === saved.algorithm_code;
                onUpdated && onUpdated(saved, wasNameOnlyChange);
            } else {
                    setEditingAlgorithm(saved);
                    onCreated && onCreated({ ...saved, algorithm_name: nameToUse });
                }
            } else {
                throw new Error(data.message || 'Failed to save algorithm.');
            }
        } catch (error) {
            setError(error.response?.data?.message || "Error submitting algorithm");
            setTimeout(() => { setError('') }, 5000);
        } finally {
            setLoading(false);
        }
    };

    const startCreatingNew = () => {
        setActiveDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
        setAlgorithmCode('');
        setAlgorithmName('');
        setChronology(0.6);
        setContentType({ images: true, text: true, videos: true, interactive: true });
        setCustomInstruction('');
        setEditingAlgorithm(null);
        setWordRange([0, 100]);
        setVideoRange([0, 100]);
        setSentiment(0.2);
        setStartTime('00:00');
        setEndTime('23:59');
        setTemplate('none');
        setWordBoost('');
        setWordSuppress('');
        setVariety(0.5);
        setVoteImpact(0.6);

        setLearningRate(0.5);
        setInteractionWeights({
            upvotes: 0.3,
            comments: 0.25,
            shares: 0.2,
            saves: 0.15,
            viewDuration: 0.1
        });
        setAuthorDiversity(0.5);
        setControversyScore(0);
        setAccountSizePreference(0.5);
        setSourceDiversity(0.5);
    }

    const templateChange = (templateKey) => {
        setTemplate(templateKey);
        if (templateKey === 'none') {
            setActiveDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
            setChronology(0.6);
            setSentiment(0.2);
            setVoteImpact(0.8);
            setWordBoost('');
            setWordSuppress('');
            setVariety(0.5);
            setCustomInstruction('');
            setGenerateCode(true);
            setWordRange([0, 100]);
            setVideoRange([0, 100]);
            setContentType({ images: true, text: true, videos: true, interactive: true });

            setLearningRate(0.5);
            setInteractionWeights({
                upvotes: 0.3,
                comments: 0.25,
                shares: 0.2,
                saves: 0.15,
                viewDuration: 0.1
            });
            setAuthorDiversity(0.5);
            setControversyScore(0);
            setAccountSizePreference(0.5);
            setSourceDiversity(0.5);
            return;
        }
        const templateConfig = ALGORITHM_TEMPLATES[templateKey];
        if (templateConfig) {
            setActiveDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
            setChronology(templateConfig.chronology);
            setSentiment(templateConfig.sentiment);
            setVoteImpact(templateConfig.voteImpact);
            setWordBoost(templateConfig.wordBoost);
            setWordSuppress(templateConfig.wordSuppress);
            setVariety(templateConfig.variety);
            setCustomInstruction(templateConfig.customInstruction);
            setGenerateCode(false);
            setWordRange([
                templateConfig.minWords ? inverseLogScale(templateConfig.minWords, 1, 5000) : 0,
                templateConfig.maxWords ? inverseLogScale(templateConfig.maxWords, 1, 5000) : 100
            ]);
            setVideoRange([
                templateConfig.minVideo ? inverseLogScale(templateConfig.minVideo, 5, 3600) : 0,
                templateConfig.maxVideo ? inverseLogScale(templateConfig.maxVideo, 5, 3600) : 100
            ]);
            setContentType(templateConfig.contentType);
            if (!algorithmName || Object.values(ALGORITHM_TEMPLATES).some(t => t.name === algorithmName)) {
                setAlgorithmName(templateConfig.name);
            }

            setLearningRate(0.5);
            setInteractionWeights({
                upvotes: 0.3,
                comments: 0.25,
                shares: 0.2,
                saves: 0.15,
                viewDuration: 0.1
            });
            setAuthorDiversity(0.5);
            setControversyScore(0);
            setAccountSizePreference(0.5);
            setSourceDiversity(0.5);
        }
    };

    const toggleDay = (day) => {
        setActiveDays(prev => 
            prev.includes(day) 
                ? prev.filter(d => d !== day)  //Remove if active
                : [...prev, day]               //Add if inactive
        );
    }

    useEffect(() => {
        if (customInstruction.trim()) {
            if (template === 'none') {
                setGenerateCode(true);
            } else {
                setGenerateCode(false);
            }
        } else {
            setGenerateCode(false);
        }
    }, [customInstruction, template]);

    useEffect(() => {
        if (editingAlgorithm) {
            const { algorithm_code = '', algorithm_name = '' } = editingAlgorithm;
            let parsedAlgorithmCode = algorithm_code;
            if (typeof algorithm_code === 'string' && algorithm_code) {
                try {
                    parsedAlgorithmCode = JSON.parse(algorithm_code);
                } catch (error) {
                    setError(error.response?.data?.message || "Error getting algorithm");
                    parsedAlgorithmCode = {};
                }
            }
            setActiveDays(parsedAlgorithmCode.activeDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
            setAlgorithmCode(parsedAlgorithmCode);
            setAlgorithmName(algorithm_name);
            setChronology(parsedAlgorithmCode.chronology || 0.6);
            setContentType(parsedAlgorithmCode.contentType || { images: true, text: true, videos: true, interactive: true });
            setCustomInstruction(editingAlgorithm.custom_instruction || ''); 
            setSentiment(parsedAlgorithmCode.scoring?.sentiment ?? 0.2);
            setVoteImpact(parsedAlgorithmCode.scoring?.voteImpact ?? 0.8);
            setStartTime(parsedAlgorithmCode.startTime || '00:00');
            setEndTime(parsedAlgorithmCode.endTime || '23:59');
            setTemplate(parsedAlgorithmCode.template || 'none');
            setWordRange([ 
                parsedAlgorithmCode.wordLimits?.min ? inverseLogScale(parsedAlgorithmCode.wordLimits.min, 1, 5000) : 0, 
                parsedAlgorithmCode.wordLimits?.max ? inverseLogScale(parsedAlgorithmCode.wordLimits.max, 1, 5000) : 100 
            ]);
            setVideoRange([ 
                parsedAlgorithmCode.videoLimits?.min ? inverseLogScale(parsedAlgorithmCode.videoLimits.min, 5, 3600) : 0, 
                parsedAlgorithmCode.videoLimits?.max ? inverseLogScale(parsedAlgorithmCode.videoLimits.max, 5, 3600) : 100 
            ]);
            const wordBoostArray = parsedAlgorithmCode.scoring?.wordBoost || [];
            const wordSuppressArray = parsedAlgorithmCode.scoring?.wordSuppress || [];
            const wordBoostWords = wordBoostArray.map(item => typeof item === 'string' ? item : item.word).join(',');
            const wordSuppressWords = wordSuppressArray.map(item => typeof item === 'string' ? item : item.word).join(',');
            setWordBoost(wordBoostWords);
            setWordSuppress(wordSuppressWords);
            setVariety(parsedAlgorithmCode.variety ?? 1);

            setLearningRate(parsedAlgorithmCode.learningRate ?? 0.5);
            setInteractionWeights(parsedAlgorithmCode.interactionWeights ?? {
                upvotes: 0.3,
                comments: 0.25,
                shares: 0.2,
                saves: 0.15,
                viewDuration: 0.1
            });
            setAuthorDiversity(parsedAlgorithmCode.authorDiversity ?? 0.5);
            setControversyScore(parsedAlgorithmCode.controversyScore ?? 0);
            setAccountSizePreference(parsedAlgorithmCode.accountSizePreference ?? 0.5);
            setSourceDiversity(parsedAlgorithmCode.sourceDiversity ?? 0.5);
        } else {
            startCreatingNew();
        }
    }, [editingAlgorithm]);

    return (
        <div className="create-algorithm">
            <div className="error-state">{error}</div>
            <div className="create-header">
                <p className="medium-text">{editingAlgorithm ? 'Edit Algorithm' : 'Create New Algorithm'}</p>
		        {!display && isAuthenticated && <div>
                    {editingAlgorithm && (
                        <button className="button button--secondary" onClick={startCreatingNew} type="button" style={{ marginRight: '8px' }}>
                            Create New
                        </button>
                    )}
                    <button className="button button--success" onClick={submitAlgorithm} type="button" disabled={loading}>
                        {loading
                            ? editingAlgorithm ? 'Saving...' : 'Creating...'
                            : editingAlgorithm ? 'Save Changes' : 'Create'}
                    </button>
                </div>}
            </div>
            <div className="form hide-scrollbar">
                <div className="form-row">
                    <input
                        className="form-input"
                        placeholder="Enter name"
                        type="text"
                        value={algorithmName}
                        onChange={(e) => {
                            let v = e.target.value;
                            if (v.length > 100) v = v.slice(0, 100);
                            const r = ValidateTextInput(v, 0, 100, false);
                            setAlgorithmName(v);
                            setError(r.valid ? '' : r.error);
                        }}
                    />
                </div>
                <div className="form-row">
                    <textarea
                        className="form-textarea tiny-text"
                        placeholder="Describe your algorithm..."
                        style={{ margin: 0 }}
                        type="text"
                        value={customInstruction}
                        onChange={(e) => {
                            let v = e.target.value;
                            if (v.length > 5000) v = v.slice(0, 5000);
                            const r = ValidateTextInput(v, 0, 5000, false);
                            setCustomInstruction(v);
                            setError(r.valid ? '' : r.error);
                            setTemplate('none');
                        }}
                    />
                </div>
                <div className="form-row border-bottom">
                    <div className="form-group">
                        <div className="form-label-with-info">
                            <label className="small-text">Template</label>
                            <InfoIconWithTooltip info="Predefined algorithms. Once selected, you can customise further." />
                        </div>
                        <select className="form-select" value={template} onChange={e => templateChange(e.target.value)}>
                            <option value="none">None</option>
                            <option value="trending_discussions">Trending</option>
                            <option value="shortform_viral">Shortform</option>
                            <option value="longform_deep">Longform</option>
                            <option value="breaking_news">Breaking News</option>
                            <option value="educational">Educational</option>
                            <option value="entertainment">Entertainment & Fun</option>
                            <option value="professional">Professional Network</option>
                            <option value="positive_vibes">Positive Vibes</option>
                            <option value="tech_innovation">Tech & Innovation</option>
                            <option value="sports_fitness">Sports & Fitness</option>
                            <option value="creative_arts">Creative Arts</option>
                            <option value="high_quality">High quality</option>
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
                                    <InfoIconWithTooltip info="Prioritise newer posts. Fully newest means pure chronological order." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={chronology}
                                    onChange={e => setChronology(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Show Old</span>
                                    <span className="tiny-text">Balanced</span>
                                    <span className="tiny-text">Fresh Only</span>
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
                                    min="0"
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
                                    <InfoIconWithTooltip info="Compares post similarity to your previously upvoted posts." />
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
                                    <span className="tiny-text">Similar</span>
                                    <span className="tiny-text">Mixed</span>
                                    <span className="tiny-text">Varied</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Boost topics</label>
                                    <InfoIconWithTooltip info="Type topics, separated by commas, that you wish to see more of." />
                                </div>
                                <textarea
                                    className="form-textarea"
                                    type="text"
                                    value={wordBoost}
                                    onChange={e => setWordBoost(e.target.value)}
                                    placeholder="e.g. sports, tech"
                                />
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Suppress topics</label>
                                    <InfoIconWithTooltip info="Type topics, separated by commas, that you wish to see less of." />
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
                                    <label className="small-text">Controversy Score</label>
                                    <InfoIconWithTooltip info="Controls exposure to divisive or debate-heavy content based on engagement patterns." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    value={controversyScore}
                                    onChange={e => setControversyScore(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Avoid</span>
                                    <span className="tiny-text">Neutral</span>
                                    <span className="tiny-text">Seek</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Account Size Preference</label>
                                    <InfoIconWithTooltip info="Preference for small vs large accounts based on follower count." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={accountSizePreference}
                                    onChange={e => setAccountSizePreference(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Small</span>
                                    <span className="tiny-text">Mixed</span>
                                    <span className="tiny-text">Popular</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Source Diversity</label>
                                    <InfoIconWithTooltip info="Variety of communities and sources. Prevents echo chambers." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={sourceDiversity}
                                    onChange={e => setSourceDiversity(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Focused</span>
                                    <span className="tiny-text">Balanced</span>
                                    <span className="tiny-text">Diverse</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Author Diversity</label>
                                    <InfoIconWithTooltip info="Controls variety of content creators. Higher values prevent feed domination by few accounts." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={authorDiversity}
                                    onChange={e => setAuthorDiversity(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Concentrated</span>
                                    <span className="tiny-text">Balanced</span>
                                    <span className="tiny-text">Diverse</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Video length</label>
                                    <InfoIconWithTooltip info="Set minimum and maximum video duration." />
                                </div>
                                <DualRangeSlider
                                    value={videoRange}
                                    onChange={setVideoRange}
                                    formatValue={(val, type) => {
                                        if (val === 0 && type === 'min') return 'No min';
                                        if (val === 100 && type === 'max') return 'No max';
                                        const seconds = Math.round(logScale(val, 5, 3600));
                                        const minutes = Math.floor(seconds / 60);
                                        const remainingSeconds = seconds % 60;
                                        if (seconds < 60) {
                                            return `${seconds} sec`;
                                        } else if (remainingSeconds === 0) {
                                            return `${minutes} min`;
                                        } else {
                                            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} min`;
                                        }
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Word count</label>
                                    <InfoIconWithTooltip info="Set minimum and maximum word counts." />
                                </div>
                                <DualRangeSlider
                                    value={wordRange}
                                    onChange={setWordRange}
                                    formatValue={(val, type) => 
                                        val === 0 && type === 'min' ? 'No min' :
                                        val === 100 && type === 'max' ? 'No max' :
                                        `${Math.round(logScale(val, 1, 5000))} words`
                                    }
                                />
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
                                    <input type="checkbox" checked={contentType.interactive} onChange={e => setContentType(prev => ({ ...prev, interactive: e.target.checked }))} /> Custom
                                </label>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
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
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('monday')} 
                                        onChange={() => toggleDay('monday')} 
                                    /> Mon
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('tuesday')} 
                                        onChange={() => toggleDay('tuesday')} 
                                    /> Tue
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('wednesday')} 
                                        onChange={() => toggleDay('wednesday')} 
                                    /> Wed
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('thursday')} 
                                        onChange={() => toggleDay('thursday')} 
                                    /> Thur
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('friday')} 
                                        onChange={() => toggleDay('friday')} 
                                    /> Fri
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('saturday')} 
                                        onChange={() => toggleDay('saturday')} 
                                    /> Sat
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isDayActive('sunday')} 
                                        onChange={() => toggleDay('sunday')} 
                                    /> Sun
                                </label>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-label-with-info">
                                <label className="small-text">Algorithm Insights</label>
                                <InfoIconWithTooltip info="View what your algorithm has learned about your preferences and behavior patterns." />
                            </div>
                            <button className="button button--secondary" type="button" onClick={() => alert('Algorithm insights dashboard - Coming soon!')}>
                                View Algorithm Insights
                            </button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <div className="form-label-with-info">
                                    <label className="small-text">Learning Rate</label>
                                    <InfoIconWithTooltip info="Controls how quickly the algorithm adapts to your recent behavior. Lower = more stable, Higher = more adaptive." />
                                </div>
                                <input
                                    className="form-input"
                                    required
                                    step="0.1"
                                    type="range"
                                    min="0"
                                    max="1"
                                    value={learningRate}
                                    onChange={e => setLearningRate(parseFloat(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span className="tiny-text">Static</span>
                                    <span className="tiny-text">Balanced</span>
                                    <span className="tiny-text">Adaptive</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-label-with-info">
                                <label className="small-text">Interaction Weighting</label>
                                <InfoIconWithTooltip info="Define which actions tell the algorithm most about your preferences. All weights are relative to each other." />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="tiny-text">Upvotes: {(interactionWeights.upvotes * 100).toFixed(0)}%</label>
                                    <input
                                        className="form-input"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={interactionWeights.upvotes}
                                        onChange={e => setInteractionWeights(prev => ({ ...prev, upvotes: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="tiny-text">Comments: {(interactionWeights.comments * 100).toFixed(0)}%</label>
                                    <input
                                        className="form-input"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={interactionWeights.comments}
                                        onChange={e => setInteractionWeights(prev => ({ ...prev, comments: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="tiny-text">Shares: {(interactionWeights.shares * 100).toFixed(0)}%</label>
                                    <input
                                        className="form-input"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={interactionWeights.shares}
                                        onChange={e => setInteractionWeights(prev => ({ ...prev, shares: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="tiny-text">Saves: {(interactionWeights.saves * 100).toFixed(0)}%</label>
                                    <input
                                        className="form-input"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={interactionWeights.saves}
                                        onChange={e => setInteractionWeights(prev => ({ ...prev, saves: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="tiny-text">View Duration: {(interactionWeights.viewDuration * 100).toFixed(0)}%</label>
                                    <input
                                        className="form-input"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={interactionWeights.viewDuration}
                                        onChange={e => setInteractionWeights(prev => ({ ...prev, viewDuration: parseFloat(e.target.value) }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="form-row border-bottom">
                            <div className="form-label-with-info">
                                <label className="small-text">Data Management</label>
                                <InfoIconWithTooltip info="View, export, or reset your algorithm's learned preferences." />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button className="button button--secondary" type="button" onClick={() => alert('View data profile - Coming soon!')}>
                                    View Data Profile
                                </button>
                                <button className="button button--secondary" type="button" onClick={() => alert('Export data - Coming soon!')}>
                                    Export Data
                                </button>
                                <button className="button button--danger" type="button" onClick={() => window.confirm('Reset all learned preferences? This cannot be undone.') && alert('Reset learning - Coming soon!')}>
                                    Reset Learning
                                </button>
                            </div>
                        </div>
                        <div className="create-header" style={{ justifyContent: 'end' }}>
                            {!display && isAuthenticated && <div>
                                {editingAlgorithm && (
                                    <button className="button button--secondary" onClick={startCreatingNew} type="button" style={{ marginRight: '8px' }}>
                                        Create New
                                    </button>
                                )}
                                <button className="button button--success" onClick={submitAlgorithm} type="button" disabled={loading}>
                                    {loading
                                        ? editingAlgorithm ? 'Saving...' : 'Creating...'
                                        : editingAlgorithm ? 'Save Changes' : 'Create'}
                                </button>
                            </div>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AddAlgorithm;