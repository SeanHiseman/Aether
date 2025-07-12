import axios from 'axios';
import { useEffect, useState } from 'react';

const AddAlgorithm = ({ algorithms = [], editingAlgorithm = null, locationId, onCreated, onUpdated }) => {
	const [algorithmDescription, setAlgorithmDescription] = useState('');
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
	const [strength, setStrength] = useState(1);
	const [template, setTemplate] = useState('none');
	const [wordBoost, setWordBoost] = useState('');
	const [wordSuppress, setWordSuppress] = useState('');

	useEffect(() => {
		if (editingAlgorithm) {
			const { algorithm_code = '{}', algorithm_description = '', algorithm_name = '' } = editingAlgorithm;
			const code = JSON.parse(algorithm_code);
			setAlgorithmDescription(algorithm_description);
			setAlgorithmName(algorithm_name);
			setChronology(code.chronology || 'newest');
			setContentType(code.contentType || { images: true, text: true, videos: true, interactive: true });
			setSentiment(code.sentiment ?? 0);
			setSimilarity(code.similarity ?? 0);
			setStartTime(code.startTime || '00:00');
			setEndTime(code.endTime || '23:59');
			setStrength(code.strength ?? 1);
			setTemplate(code.template || 'none');
			setWordBoost((code.wordBoost || []).join(','));
			setWordSuppress((code.wordSuppress || []).join(','));
		}
	}, [editingAlgorithm]);

	const submitAlgorithm = async () => {
		try {
			setError(null);
			setLoading(true);
			const nameToUse = algorithmName.trim() || `Algorithm ${algorithms.length + 1}`;
			const payload = {
				algorithmDescription,
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
				wordSuppress: wordSuppress.split(',').map(w => w.trim()).filter(Boolean)
			};
			const { data } = editingAlgorithm
				? await axios.put('/api/edit_algorithm', payload)
				: await axios.post('/api/create_algorithm', payload);
			if (data.success) {
				const saved = data.updatedAlgorithm || data.newAlgorithm;
				editingAlgorithm ? onUpdated && onUpdated(saved) : onCreated && onCreated(saved);
				setAlgorithmName('');
				setWordBoost('');
				setWordSuppress('');
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

	return (
		<div className="create-algorithm">
			<div className="create-header">
				<p className="medium-text">{editingAlgorithm ? 'Edit Algorithm' : 'Create New Algorithm'}</p>
				<button className="button button--success" onClick={submitAlgorithm} type="button" title="Create new algorithm" disabled={loading}>
					{loading
						? editingAlgorithm ? 'Saving...' : 'Creating...'
						: editingAlgorithm ? 'Save Changes' : 'Create'}
				</button>
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
						placeholder="Describe your algorithm..."
						required
						type="text"
						value={customInstruction}
						onChange={e => setCustomInstruction(e.target.value)}
					/>
				</div>
				<div className="form-row">
					<div className="form-group">
						<label className="small-text">Template</label>
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
						<label className="small-text">Chronology</label>
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
				</div>
				<div className="form-row">
					<div className="form-group">
						<label className="small-text">Sentiment Boost/Decay</label>
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
						<label className="small-text">Content Variety</label>
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
				</div>
				<div className="form-row">
					<label className="small-text">Content Types</label>
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
				<div className="form-row">
					<div className="form-group">
						<label className="small-text">Boost Words</label>
						<input
							className="form-input"
							type="text"
							value={wordBoost}
							onChange={e => setWordBoost(e.target.value)}
							placeholder="e.g. sports,tech"
						/>
					</div>
					<div className="form-group">
						<label className="small-text">Suppress Words</label>
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
						<label className="small-text">Active Hours</label>
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
						<label className="small-text">Similarity to Upvoted Posts</label>
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
				</div>
				{error && <div className="error-state">{error}</div>}
			</div>
		</div>
	);
};

export default AddAlgorithm;