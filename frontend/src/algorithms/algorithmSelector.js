import axios from 'axios';
import { useEffect, useState } from 'react';
import AddAlgorithm from './addAlgorithm';

const AlgorithmSelector = ({ feedId }) => {
	const [algorithms, setAlgorithms] = useState([]);
	const [assignedAlgorithmId, setAssignedAlgorithmId] = useState('');
	const [assignError, setAssignError] = useState(null);
	const [editingAlgorithm, setEditingAlgorithm] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [optionsOpen, setOptionsOpen] = useState(false);

	const assignAlgorithm = async (algorithmId) => {
		setAssignError(null);
		try {
			if (assignedAlgorithmId) {
				await axios.delete('/api/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, feedId }
				});
			}
			const response = await axios.post('/api/assign_algorithm', {
				algorithmId,
				feedId
			});
			if (!response.data.success) throw new Error(response.data.message || 'Failed to assign algorithm.');
			setAssignedAlgorithmId(algorithmId);
			setOptionsOpen(false);
		} catch (error) {
			setAssignError(error.response?.data?.error || error.message || 'Failed to assign algorithm.');
		} 
	};

	const closeModal = () => {
		setAssignError(null);
		setEditingAlgorithm(false);
		setError(null);
		setModalOpen(false);
		setOptionsOpen(false);
	};

	const deleteAlgorithm = async algorithmId => {
		try {
			await axios.delete('/api/delete_algorithm', {
				data: { algorithmId, feedId }
			});
			setAlgorithms(prev => prev.filter(a => a.algorithm_id !== algorithmId));
			if (algorithmId === assignedAlgorithmId) setAssignedAlgorithmId('');
		} catch (error) {
			setError(error.response?.data?.error || error.message || 'Failed to delete algorithm.');
		}
	};

	const fetchAlgorithms = async () => {
		setError(null);
		setLoading(true);
		try {
			const { data } = await axios.get('/api/get_user_algorithms');
			if (!data.success) throw new Error(data.message || 'Failed to load algorithms.');
			setAlgorithms(data.algorithms);
			const assigned = data.algorithms.find(a =>
				a.feed_algorithms?.some(fa => fa.feed_id === feedId)
			);
			setAssignedAlgorithmId(assigned ? assigned.algorithm_id : '');
		} catch (error) {
			setError(error.response?.data?.error || error.message || 'Failed to load algorithms.');
		} finally {
			setLoading(false);
		}
	};

	const handleCreated = newAlgo => {
		setAlgorithms(prev => [...prev, newAlgo]);
		assignAlgorithm(newAlgo.algorithm_id);
	};

	const selectAlgorithm = (algorithmId) => {
		const algorithm = algorithms.find(a => a.algorithm_id === algorithmId);
		const isAlreadyAssigned = algorithm?.feed_algorithms?.some(fa => fa.feed_id === feedId);
		if (isAlreadyAssigned) return;
		assignAlgorithm(algorithmId);
	};

	const updateAlgorithms = updatedAlgo => {
		setAlgorithms(prev => prev.map(a => a.algorithm_id === updatedAlgo.algorithm_id ? updatedAlgo : a));
		setEditingAlgorithm(null);
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
						<button className="button" onClick={closeModal}>✕</button>
						{loading && <div className="loading-state">Loading algorithms...</div>}
						{!loading && (
							<>
								<div className="choose-algorithm">
									{assignedAlgorithmId && (
										<p className="current-assignment">
											Currently algorithm:&nbsp;
											{algorithms.find(a => a.algorithm_id === assignedAlgorithmId)?.algorithm_name}
										</p>
									)}
									<div className={`dropdown${optionsOpen ? ' open' : ''}`}>
										<div
											className="form-select dropdown-trigger"
											onClick={() => setOptionsOpen(o => !o)}
										>
											{assignedAlgorithmId
												? algorithms.find(a => a.algorithm_id === assignedAlgorithmId)?.algorithm_name
												: 'Choose an algorithm...'}
										</div>
										{optionsOpen && (
											<ul className="algorithm-options">
												{algorithms.map(a => {
													const isAssigned = a.feed_algorithms?.some(fa => fa.feed_id === feedId);
													const isCurrentlyAssigned = a.algorithm_id === assignedAlgorithmId;
													return (
														<li key={a.algorithm_id} className={isAssigned ? 'assigned' : ''}>
															<label
																onClick={() => selectAlgorithm(a.algorithm_id)}
																style={{ 
																	cursor: isAssigned && !isCurrentlyAssigned ? 'not-allowed' : 'pointer',
																	opacity: isAssigned && !isCurrentlyAssigned ? 0.6 : 1
																}}
															>
																<input
																	checked={isCurrentlyAssigned}
																	disabled={isAssigned && !isCurrentlyAssigned}
																	name="algorithm"
																	readOnly
																	type="radio"
																	value={a.algorithm_id}
																/>
																{a.algorithm_name}
																{isAssigned ? ' (assigned)' : ''}
															</label>
															<button
																className="small-icon"
																onClick={e => {
																	e.stopPropagation();
																	setEditingAlgorithm(a);
																}}
																title="Edit algorithm"
															>✏️</button>
															<button
																className="small-icon"
																onClick={e => {
																	e.stopPropagation();
																	deleteAlgorithm(a.algorithm_id);
																}}
																title="Delete algorithm"
															>🗑️</button>
														</li>
													);
												})}
											</ul>
										)}
									</div>
									{assignError && <div className="error-state">{assignError}</div>}
								</div>
								<AddAlgorithm algorithms={algorithms} editingAlgorithm={editingAlgorithm} feedId={feedId} onCreated={handleCreated} onUpdated={updateAlgorithms} />
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