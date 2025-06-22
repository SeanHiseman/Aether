import axios from 'axios';
import { useEffect, useState } from 'react';
import AddAlgorithm from './addAlgorithm';

const AlgorithmSelector = ({ feedId }) => {
	const [assignError, setAssignError] = useState(null);
	const [assignLoading, setAssignLoading] = useState(false);
	const [algorithms, setAlgorithms] = useState([]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedAlgorithmId, setSelectedAlgorithmId] = useState('');

	const closeModal = () => {
		setAssignError(null);
		setError(null);
		setModalOpen(false);
		setSelectedAlgorithmId('');
	};

	const fetchAlgorithms = async () => {
		setError(null);
		setLoading(true);
		try {
			const { data } = await axios.get('/api/get_user_algorithms');
			if (data.success) {
				setAlgorithms(data.algorithms);
			} else {
				throw new Error(data.message || 'Failed to load algorithms.');
			}
		} catch (err) {
			setError(err.response?.data?.error || err.message || 'Failed to load algorithms.');
		} finally {
			setLoading(false);
		}
	};

	const handleAssign = async () => {
		setAssignError(null);
		if (!selectedAlgorithmId) {
			setAssignError('Please select an algorithm.');
			return;
		}
		setAssignLoading(true);
		try {
			const { data } = await axios.post('/api/assign_algorithm', {
				feedId,
				algorithmId: selectedAlgorithmId
			});
			if (data.success) {
				closeModal();
			} else {
				throw new Error(data.message || 'Failed to assign algorithm.');
			}
		} catch (err) {
			setAssignError(err.response?.data?.error || err.message || 'Failed to assign algorithm.');
		} finally {
			setAssignLoading(false);
		}
	};

	const handleCreated = newAlgo => {
		setAlgorithms(prev => [...prev, newAlgo]);
		setSelectedAlgorithmId(newAlgo.algorithm_id);
		setTimeout(handleAssign, 0);
	};

	useEffect(() => {
		if (modalOpen) fetchAlgorithms();
	}, [modalOpen]);

	if (!feedId) return null;

	return (
		<div className="algorithm-selector">
			<button
				className="algorithm-selector__trigger"
				onClick={() => setModalOpen(true)}
			>
				Choose Algorithm
			</button>
			{modalOpen && (
				<div className="algorithm-overlay" onClick={closeModal}>
					<div className="algorithm-content" onClick={e => e.stopPropagation()}>
						<div className="algorithm-header">
							<p className="text36">Algorithm Selection</p>
							<button className="button" onClick={closeModal}>✕</button>
						</div>
						{loading && <div className="loading-state">Loading algorithms...</div>}
						{!loading && (
							<>
								<div className="section">
									<div className="form-group">
										<label className="text24">Available Algorithms</label>
										<select
											className="form-select"
											value={selectedAlgorithmId}
											onChange={e => setSelectedAlgorithmId(e.target.value)}
										>
											<option value="">Choose an algorithm...</option>
											{algorithms.map(a => (
												<option key={a.algorithm_id} value={a.algorithm_id}>
													{a.algorithm_name}
												</option>
											))}
										</select>
									</div>
									<div className="action-row">
										<button
											className="button"
											onClick={handleAssign}
											disabled={assignLoading || !selectedAlgorithmId}
										>
											{assignLoading ? 'Assigning...' : 'Assign Algorithm'}
										</button>
									</div>
									{assignError && <div className="error-state">{assignError}</div>}
								</div>
								<AddAlgorithm onCreated={handleCreated} />
							</>
						)}
						{error && !loading && <div className="error-state">{error}</div>}
					</div>
				</div>
			)}
		</div>
	);
};

export default AlgorithmSelector;