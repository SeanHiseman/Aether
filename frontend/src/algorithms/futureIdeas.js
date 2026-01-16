import { FaInfoCircle } from 'react-icons/fa';
import { useState } from 'react';

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

const FutureIdeas = () => {
    const [aiContentFilters, setAiContentFilters] = useState([]);
    const [echoBreaker, setEchoBreaker] = useState(false);
    const [qualityThreshold, setQualityThreshold] = useState(40);
    const [readingTime, setReadingTime] = useState('medium');
    const [viralityDamper, setViralityDamper] = useState(0);
    const [interactionDepth, setInteractionDepth] = useState({
        quick_scroll: true,
        read: true,
        engage: true,
        deep_dive: false
    });

    const toggleContentFilter = (filter) => {
        setAiContentFilters(prev =>
            prev.includes(filter)
                ? prev.filter(f => f !== filter)
                : [...prev, filter]
        );
    };

    const toggleInteractionType = (type) => {
        setInteractionDepth(prev => ({
            ...prev,
            [type]: !prev[type]
        }));
    };

    return (
        <div className="ideas-section">
            <div className="ideas-header">
                <p className="small-text" style={{ fontWeight: 600 }}>Future Features</p>
                <span className="ideas-badge">Prototype</span>
            </div>
            <p className="ideas-description">
                These are concept features under development. They demonstrate advanced algorithmic controls
                that could give you even more power over your social media experience.
            </p>
            <div className="form-row">
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Filter out AI content</label>
                        <InfoIconWithTooltip info="Automatically detects and filters suspected AI content." />
                    </div>
                    <div className="filter-tags">
                        {['AI images', 'AI videos', 'AI text'].map(filter => (
                            <div key={filter} className={`filter-tag ${aiContentFilters.includes(filter) ? 'active' : ''}`} onClick={() => toggleContentFilter(filter)}>
                                {filter}
                                {aiContentFilters.includes(filter) && <span className="filter-tag-remove">×</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Echo Chamber Breaker</label>
                        <InfoIconWithTooltip info="Intentionally expose you to diverse viewpoints outside your usual bubble." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`toggle-switch ${echoBreaker ? 'active' : ''}`} onClick={() => setEchoBreaker(!echoBreaker)}>
                            <div className="toggle-switch-handle" />
                        </div>
                        <span className="small-text" style={{ color: 'var(--light)' }}>
                            {echoBreaker ? 'Enabled - Show me different perspectives' : 'Disabled'}
                        </span>
                    </div>
                </div>
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Virality Damper</label>
                        <InfoIconWithTooltip info="Reduce the impact of viral content. Higher values show you less of what everyone else is seeing." />
                    </div>
                    <input className="form-input" type="range" min="0" max="100" value={viralityDamper} onChange={e => setViralityDamper(parseInt(e.target.value))} />
                    <div className="slider-labels">
                        <span className="tiny-text">Show Viral ({viralityDamper}%)</span>
                        <span className="tiny-text">Hide Viral</span>
                    </div>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Minimum Quality Score</label>
                        <InfoIconWithTooltip info="Quality assessment based on grammar, coherence, sourcing, and value. Higher threshold means fewer but higher quality posts." />
                    </div>
                    <input className="form-input" type="range" min="0" max="100" value={qualityThreshold} onChange={e => setQualityThreshold(parseInt(e.target.value))} />
                    <div className="slider-labels">
                        <span className="tiny-text">Show All ({qualityThreshold}%)</span>
                        <span className="tiny-text">Very Selective</span>
                    </div>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Preferred Reading Time</label>
                        <InfoIconWithTooltip info="Optimize content length based on how much time you typically have." />
                    </div>
                    <div className="intensity-scale">
                        {[
                            { key: 'quick', label: 'Quick' },
                            { key: 'medium', label: 'Medium' },
                            { key: 'long', label: 'Long' },
                            { key: 'deep', label: 'Deep Dive' }
                        ].map(({ key, label }) => (
                            <div key={key} className={`intensity-option ${readingTime === key ? 'active' : ''}`} onClick={() => setReadingTime(key)}>
                                {label}
                            </div>
                        ))}
                    </div>
                    <div className="slider-labels">
                        <span className="tiny-text">{'< 2 min'}</span>
                        <span className="tiny-text">2-5 min</span>
                        <span className="tiny-text">5-15 min</span>
                        <span className="tiny-text">{'>15 min'}</span>
                    </div>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <div className="form-label-with-info">
                        <label className="small-text">Learn From My Interactions</label>
                        <InfoIconWithTooltip info="Choose which types of interactions should influence your algorithm." />
                    </div>
                    <div className="flex flex-col">
                        <label>
                            <input type="checkbox" checked={interactionDepth.quick_scroll} onChange={() => toggleInteractionType('quick_scroll')} />
                            Quick Scrolls (what I skip)
                        </label>
                        <label>
                            <input type="checkbox" checked={interactionDepth.read} onChange={() => toggleInteractionType('read')} />
                            Reading Time (what I pause on)
                        </label>
                        <label>
                            <input type="checkbox" checked={interactionDepth.engage} onChange={() => toggleInteractionType('engage')} />
                            Engagement (likes, comments)
                        </label>
                        <label>
                            <input type="checkbox" checked={interactionDepth.deep_dive} onChange={() => toggleInteractionType('deep_dive')} />
                            Redirects (clicking links, profiles)
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FutureIdeas;
