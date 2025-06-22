import axios from 'axios';
import { useState } from 'react';

const AddAlgorithm = ({ onCreated }) => {
	const [algorithmDescription, setAlgorithmDescription] = useState('');
	const [algorithmName, setAlgorithmName] = useState('');
	const [chronology, setChronology] = useState('newest');
	const [contentType, setContentType] = useState({ images: true, text: true, videos: true });
	const [endTime, setEndTime] = useState('23:59');
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [personalRuleInput, setPersonalRuleInput] = useState('');
	const [sentiment, setSentiment] = useState(0);
	const [similarity, setSimilarity] = useState(0);
	const [startTime, setStartTime] = useState('00:00');
	const [strength, setStrength] = useState(1);
	const [template, setTemplate] = useState('none');
	const [wordBoost, setWordBoost] = useState('');
	const [wordSuppress, setWordSuppress] = useState('');

	const handleSubmit = async () => {
		setError(null);
		if (!algorithmName.trim()) {
			setError('Name is required.');
			return;
		}
		setLoading(true);
		try {
			const { data } = await axios.post('/api/create_algorithm', {
				algorithmDescription,
				algorithmName,
				chronology,
				contentType,
				personalRuleInput,
				sentiment,
				similarity,
				startTime,
				endTime,
				strength,
				template,
				wordBoost: wordBoost.split(',').map(w => w.trim()).filter(Boolean),
				wordSuppress: wordSuppress.split(',').map(w => w.trim()).filter(Boolean)
			});
			if (data.success) {
				const newAlgo = data.newAlgorithm;
				setAlgorithmDescription('');
				setAlgorithmName('');
				setChronology('newest');
				setContentType({ images: true, text: true, videos: true });
				setPersonalRuleInput('');
				setSentiment(0);
				setSimilarity(0);
				setStartTime('00:00');
				setEndTime('23:59');
				setStrength(1);
				setTemplate('none');
				setWordBoost('');
				setWordSuppress('');
				onCreated && onCreated(newAlgo);
			} else {
				throw new Error(data.message || 'Failed to create algorithm.');
			}
		} catch (err) {
			setError(err.response?.data?.error || err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="section">
			<h3 className="section-title">Create New Algorithm</h3>
			<div className="form hide-scrollbar">
				<div className="form-group">
					<input
						className="form-input"
						placeholder="Enter name"
						required
						type="text"
						value={algorithmName}
						onChange={e => setAlgorithmName(e.target.value)}
					/>
				</div>
				<div className="form-group">
					<label className="text24">Chronology</label>
					<select
						className="form-select"
						value={chronology}
						onChange={e => setChronology(e.target.value)}
					>
						<option value="newest">Newest First</option>
						<option value="oldest">Oldest First</option>
						<option value="mixed">Mixed Chronology</option>
					</select>
				</div>
				<div className="form-group">
					<label className="text24">Sentiment Boost/Decay</label>
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
				</div>
				<div className="form-group">
					<label className="text24">Content Variety</label>
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
				</div>
				<div className="form-group">
					<label className="text24">Content Types</label>
					<div>
						<label>
							<input
								type="checkbox"
								checked={contentType.images}
								onChange={e => setContentType(prev => ({ ...prev, images: e.target.checked }))}
							/>
							Images
						</label>
						<label>
							<input
								type="checkbox"
								checked={contentType.text}
								onChange={e => setContentType(prev => ({ ...prev, text: e.target.checked }))}
							/>
							Text
						</label>
						<label>
							<input
								type="checkbox"
								checked={contentType.videos}
								onChange={e => setContentType(prev => ({ ...prev, videos: e.target.checked }))}
							/>
							Videos
						</label>
						<label>
							<input
								type="checkbox"
								checked={contentType.interactive}
								onChange={e => setContentType(prev => ({ ...prev, interactive: e.target.checked }))}
							/>
							Interactive
						</label>
					</div>
				</div>
				<div className="form-group">
					<label className="text24">Boost Words (comma separated)</label>
					<input
						className="form-input"
						type="text"
						value={wordBoost}
						onChange={e => setWordBoost(e.target.value)}
						placeholder="e.g. sports,tech"
					/>
				</div>
				<div className="form-group">
					<label className="text24">Suppress Words (comma separated)</label>
					<input
						className="form-input"
						type="text"
						value={wordSuppress}
						onChange={e => setWordSuppress(e.target.value)}
						placeholder="e.g. politics"
					/>
				</div>
				<div className="form-group">
					<label className="text24">Personal Rule</label>
					<input
						className="form-input"
						required
						type="text"
						value={personalRuleInput}
						onChange={e => setPersonalRuleInput(e.target.value)}
						placeholder="e.g. no posts from feed X after 8pm"
					/>
				</div>
				<div className="form-group">
					<label className="text24">Active Hours</label>
					<div>
						<input
							type="time"
							value={startTime}
							onChange={e => setStartTime(e.target.value)}
						/>
						-
						<input
							type="time"
							value={endTime}
							onChange={e => setEndTime(e.target.value)}
						/>
					</div>
				</div>
				<div className="form-group">
					<label className="text24">Template</label>
					<select
						className="form-select"
						value={template}
						onChange={e => setTemplate(e.target.value)}
					>
						<option value="none">None</option>
						<option value="work">Work Focus</option>
						<option value="weekend">Weekend Leisure</option>
						<option value="news">News Only</option>
					</select>
				</div>
				<div className="form-group">
					<label className="text24">Similarity to Upvoted Posts</label>
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
				</div>
				{error && <div className="error-state">{error}</div>}
				<div className="form-actions">
					<button
						className="button button--success"
						onClick={handleSubmit}
						type="button"
						disabled={loading}
					>
						{loading ? 'Creating...' : 'Create Algorithm'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default AddAlgorithm;