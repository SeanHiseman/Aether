import axios from 'axios';
import { useEffect, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import AddAlgorithm from './addAlgorithm';

const AlgorithmSelector = ({ locationId }) => {
	const [algorithms, setAlgorithms] = useState([]);
	const [assignedAlgorithmId, setAssignedAlgorithmId] = useState('');
	const [assignError, setAssignError] = useState(null);
	const [editingAlgorithm, setEditingAlgorithm] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [optionsOpen, setOptionsOpen] = useState(false);

	const assignAlgorithm = async (algorithmId) => {
		try {
			setAssignError(null);
			if (assignedAlgorithmId) {
				await axios.delete('/api/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, locationId }
				});
			}
			const response = await axios.post('/api/assign_algorithm', {
				algorithmId,
				locationId
			});
			if (!response.data.success) throw new Error(response.data.message || 'Failed to assign algorithm.');
			setAssignedAlgorithmId(algorithmId);
			setAlgorithms(prev => {
				const updated = prev.map(algo => ({
					...algo,
					algorithm_locations: algo.algorithm_id === algorithmId 
						? [...(algo.algorithm_locations || []), { location_id: locationId }]
						: (algo.algorithm_locations || []).filter(loc => loc.location_id !== locationId)
				}))
				//Manually move assigned algorithm to top of the list, so that fetchAlgorithms() does not need to be called again
				updated.sort((a, b) => a.algorithm_name.localeCompare(b.algorithm_name));
				const index = updated.findIndex(a => a.algorithm_id === algorithmId);
				if (index > 0) {
					const [assigned] = updated.splice(index, 1);
					updated.unshift(assigned);
				}
				return updated;
			});
		} catch (error) {
			console.error('Error assigning algorithm:', error);
			setAssignError('Failed to assign algorithm');
			setTimeout(() => { setAssignError('') }, 3000);
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
				data: { algorithmId, locationId }
			});
			setAlgorithms(prev => prev.filter(a => a.algorithm_id !== algorithmId));
			if (algorithmId === assignedAlgorithmId) setAssignedAlgorithmId('');
		} catch (error) {
			setError('Failed to delete algorithm');
			setTimeout(() => { setError('') }, 3000);
		}
	};

	const fetchAlgorithms = async () => {
		try {
			setError(null);
			setLoading(true);
			const { data } = await axios.get('/api/get_user_algorithms');
			if (!data.success) throw new Error(data.message || 'Failed to load algorithms.');
			const assigned = data.algorithms.find(a =>
				a.algorithm_locations?.some(fa => fa.location_id === locationId)
			);
			const assignedId = assigned ? assigned.algorithm_id : '';
			const sorted = [...data.algorithms].sort((a, b) => a.algorithm_name.localeCompare(b.algorithm_name));
			if (assignedId) {
				const assignedIndex = sorted.findIndex(a => a.algorithm_id === assignedId);
				if (assignedIndex > 0) {
					const [assignedAlgo] = sorted.splice(assignedIndex, 1);
					sorted.unshift(assignedAlgo);
				}
			}
			setAlgorithms(sorted);
			setAssignedAlgorithmId(assignedId);
		} catch (error) {
			setError('Failed to load algorithms');
			setTimeout(() => { setError('') }, 3000);
		} finally {
			setLoading(false);
		}
	};

	const handleCreated = newAlgo => {
		const newAlgoWithLocation = {
			...newAlgo,
			algorithm_locations: [{ location_id: locationId }]
		};
		//Manually move assigned algorithm to top of the list, so that fetchAlgorithms() does not need to be called again
		setAlgorithms(prev => {
			const updated = [...prev, newAlgoWithLocation]
			updated.sort((a, b) => a.algorithm_name.localeCompare(b.algorithm_name));
			const index = updated.findIndex(a => a.algorithm_id === newAlgo.algorithm_id);
			if (index > 0) {
				const [created] = updated.splice(index, 1);
				updated.unshift(created);
			}
			return updated;
		});
		assignAlgorithm(newAlgo.algorithm_id);
	};

	const selectAlgorithm = algorithmId => {
		const algorithm = algorithms.find(a => a.algorithm_id === algorithmId);
		const isAlreadyAssigned = algorithm?.algorithm_locations?.some(fa => fa.location_id === locationId);
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

	if (!locationId) return null;

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
						<div className="selector-header">
							<button className="button" onClick={closeModal} title="Close">✕</button>
							<div className="error-message">{assignError}</div>
						</div>
						{loading && <div className="loading-state">Loading algorithms...</div>}
						{!loading && (
							<>
								<div className="choose-algorithm">
									<div className={`dropdown${optionsOpen ? ' open' : ''}`}>
										<div
											className="form-select dropdown-trigger"
											onClick={() => setOptionsOpen(o => !o)}
										>
											{assignedAlgorithmId
												? `Assigned algorithm: ${algorithms.find(a => a.algorithm_id === assignedAlgorithmId)?.algorithm_name}`
												: 'Choose an algorithm...'}
										</div>
										{optionsOpen && (
											<ul className="algorithm-options">
												{algorithms.map(a => {
													const isAssigned = a.algorithm_locations?.some(fa => fa.location_id === locationId);
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
																{a.algorithm_name}{isAssigned ? ' (assigned)' : ''}
															</label>
															<button
																className="small-icon"
																onClick={e => {
																	e.stopPropagation();
																	setEditingAlgorithm(a);
																}}
																title="Edit algorithm"
															><FaEdit /></button>
															<button
																className="small-icon"
																onClick={e => {
																	e.stopPropagation();
																	deleteAlgorithm(a.algorithm_id);
																}}
																title="Delete algorithm"
															><FaTrash /></button>
														</li>
													);
												})}
											</ul>
										)}
									</div>
								</div>
								<AddAlgorithm algorithms={algorithms} editingAlgorithm={editingAlgorithm} locationId={locationId} onCreated={handleCreated} onUpdated={updateAlgorithms} />
							</>
						)}
						<div className="error-message">{error}</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AlgorithmSelector;