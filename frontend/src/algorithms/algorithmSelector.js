import axios from 'axios';
import { createPortal } from 'react-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import AddAlgorithm from './addAlgorithm';

const AlgorithmSelector = ({ locationId, refreshPosts }) => {
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
			if (loading || assignedAlgorithmId === algorithmId) return;
			setLoading(true);
			setAssignError(null);
			if (algorithmId) {
				const response = await axios.post('/api/assign_algorithm', {
					algorithmId,
					locationId
				});
				if (!response?.data?.success) throw new Error(response?.data?.message || 'Failed to assign algorithm.');
				setAssignedAlgorithmId(algorithmId);
			} else {
				const response = await axios.delete('/api/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, locationId }
				});
				setAssignedAlgorithmId('');
				setEditingAlgorithm(null);
			}
			refreshPosts(); 
			setAlgorithms(prev => {
				const updated = prev.map(algo => ({
					...algo,
					algorithm_locations: algo?.algorithm_id === algorithmId 
						? [...(algo?.algorithm_locations || []), { location_id: locationId }]
						: (algo?.algorithm_locations || []).filter(loc => loc?.location_id !== locationId)
				}));
				updated.sort((a, b) => a?.algorithm_name?.localeCompare(b?.algorithm_name));
				if (algorithmId) {
					const index = updated.findIndex(a => a?.algorithm_id === algorithmId);
					if (index > 0) {
						const [assigned] = updated.splice(index, 1);
						updated.unshift(assigned);
					}
				}
				return updated;
			});
		} catch (error) {
			setAssignError(error.response?.data?.message || 'Failed to assign algorithm');
			setTimeout(() => { setAssignError('') }, 3000);
		} finally {
			setLoading(false);
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
			setAlgorithms(prev => prev.filter(a => a?.algorithm_id !== algorithmId));
			if (algorithmId === assignedAlgorithmId) setAssignedAlgorithmId('');
			if (editingAlgorithm?.algorithm_id === algorithmId) setEditingAlgorithm(null);
		} catch (error) {
			setError(error.response?.data?.message || 'Failed to delete algorithm');
			setTimeout(() => { setError('') }, 3000);
		}
	};

	const fetchAlgorithms = async () => {
		try {
			setError(null);
			setLoading(true);
			const response = await axios.get('/api/get_viewer_algorithms');
			if (response.data.success) {
				const assigned = response.data.algorithms.find(a =>
					a?.algorithm_locations?.some(fa => fa?.location_id === locationId)
				);
				const assignedId = assigned ? assigned?.algorithm_id : '';
				const sorted = [...response?.data?.algorithms].sort((a, b) => a?.algorithm_name?.localeCompare(b?.algorithm_name));
				if (assignedId) {
					const assignedIndex = sorted.findIndex(a => a?.algorithm_id === assignedId);
					if (assignedIndex > 0) {
						const [assignedAlgo] = sorted.splice(assignedIndex, 1);
						sorted.unshift(assignedAlgo);
					}
				}
				setAlgorithms(sorted);
				setAssignedAlgorithmId(assignedId);
				if (assigned) {
					setEditingAlgorithm(assigned);
				}
			}
		} catch (error) {
			setError(error.response?.data?.message || 'Failed to load algorithms');
			setTimeout(() => { setError('') }, 5000);
		} finally {
			setLoading(false);
		}
	};

	const handleCreated = newAlgo => {
		try {
			const newAlgoWithLocation = {
				...newAlgo,
				algorithm_locations: [{ location_id: locationId }]
			};
			//Manually move assigned algorithm to top of the list, so that fetchAlgorithms() does not need to be called again
			setAlgorithms(prev => {
				const updated = [...prev, newAlgoWithLocation]
				updated.sort((a, b) => a?.algorithm_name?.localeCompare(b?.algorithm_name));
				const index = updated.findIndex(a => a?.algorithm_id === newAlgo?.algorithm_id);
				if (index > 0) {
					const [created] = updated.splice(index, 1);
					updated.unshift(created);
				}
				return updated;
			});
			assignAlgorithm(newAlgo?.algorithm_id);
			refreshPosts(); 
		} catch (error) {
			setError(error.response?.data?.message || 'Failed to update algorithms');
			setTimeout(() => { setError('') }, 5000);
		}
	};

	const selectAlgorithm = algorithmId => {
		const algorithm = algorithms.find(a => a?.algorithm_id === algorithmId);
		const isAlreadyAssigned = algorithm?.algorithm_locations?.some(fa => fa?.location_id === locationId);
		if (isAlreadyAssigned) return;
		assignAlgorithm(algorithmId);
		setEditingAlgorithm(algorithm || null);
	};

	const selectRadio = algorithmId => {
		if (algorithmId === '') {
			unassignAlgorithm();
			setEditingAlgorithm(null);
		} else {
			selectAlgorithm(algorithmId);
		}
	};

	const unassignAlgorithm = async () => {
		try {
			setAssignError(null);
			if (assignedAlgorithmId) {
				await axios.delete('/api/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, locationId }
				});	
			}
			setAssignedAlgorithmId('');
			setAlgorithms(prev => prev.map(algo => ({
				...algo,
				algorithm_locations: (algo?.algorithm_locations || []).filter(loc => loc?.location_id !== locationId)
			})));
			setEditingAlgorithm(null);
			refreshPosts();
		} catch (error) {
			setAssignError(error.response?.data?.message || 'Failed to unassign algorithm');
			setTimeout(() => { setAssignError('') }, 3000);
		};
	};

	const updateAlgorithms = updatedAlgo => {
		setAlgorithms(prev => prev.map(a => a?.algorithm_id === updatedAlgo?.algorithm_id ? updatedAlgo : a));
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
			{modalOpen && createPortal(
				<div className="algorithm-overlay" onClick={closeModal}>
					<div className="algorithm-content" onClick={e => e.stopPropagation()}>
						<div className="selector-header">
							<button className="button" onClick={closeModal} title="Close">✕</button>
							<div className="error-message">{assignError}</div>
							<p className="tiny-text">Changing the algorithm will reload posts</p>
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
												: algorithms.length !== 0 ? 'Choose an algorithm...' : 'No algorithms assigned'}
										</div>
										{optionsOpen && (
											<ul className="algorithm-options">
												<li key="unassign">
													<label
														onClick={() => selectRadio('')}
														style={{
															cursor: assignedAlgorithmId ? 'pointer' : 'not-allowed',
															opacity: assignedAlgorithmId ? 1 : 0.6,
														}}
													>	
														<input
															name="algorithm"
															readOnly
															type="radio"
															value=""
															checked={assignedAlgorithmId === ''}
															disabled={!assignedAlgorithmId}
														/>
														No algorithm
													</label>
												</li>
												{algorithms.map(a => {
													const isCurrentlyAssigned = a.algorithm_id === assignedAlgorithmId;
													return (
														<li key={a.algorithm_id} className={isCurrentlyAssigned ? 'assigned' : ''}>
															<label onClick={() => selectRadio(a.algorithm_id)} style={{ cursor:'pointer' }}>
																<input
																	checked={isCurrentlyAssigned}
																	name="algorithm"
																	readOnly
																	type="radio"
																	value={a.algorithm_id}
																/>
																{a.algorithm_name}{isCurrentlyAssigned ? ' (assigned)' : ''}
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
								<AddAlgorithm 
									algorithms={algorithms} 
									editingAlgorithm={editingAlgorithm} 
									locationId={locationId} 
									onCreated={handleCreated} 
									onUpdated={updateAlgorithms} 
									setEditingAlgorithm={setEditingAlgorithm}
								/>
							</>
						)}
						<div className="error-message">{error}</div>
					</div>
				</div>,
				document.body 
			)}
		</div>
	);
};

export default AlgorithmSelector;