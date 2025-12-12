import AddAlgorithm from './addAlgorithm';
import api from '../api';
import { createPortal } from 'react-dom';
import { FaEdit, FaSlidersH, FaTrash } from 'react-icons/fa';
import { loadWelcomeAlgorithms } from '../pages/welcome/welcomeContent';
import { useEffect, useState } from 'react';

const AlgorithmSelector = ({ display = false, isAuthenticated = false, locationId, refreshPosts }) => {
	const [algorithms, setAlgorithms] = useState([]);
	const [assignedAlgorithmId, setAssignedAlgorithmId] = useState('');
	const [assignError, setAssignError] = useState(null);
	const [editingAlgorithm, setEditingAlgorithm] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(display || false);
	const [optionsOpen, setOptionsOpen] = useState(false);

	const assignAlgorithm = async (algorithmId) => {
		try {
			if (display || !isAuthenticated || loading || assignedAlgorithmId === algorithmId) return;
			setLoading(true);
			setAssignError(null);
			if (algorithmId) {
				const response = await api.post('/assign_algorithm', {
					algorithmId,
					locationId
				});
				if (!response.data?.success) throw new Error(response.data?.message || 'Failed to assign algorithm.');
				setAssignedAlgorithmId(algorithmId);
			} else {
				await api.delete('/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, locationId }
				});
				setAssignedAlgorithmId('');
				setEditingAlgorithm(null);
			}
			if (!display) refreshPosts(); 
			setAlgorithms(prev => {
				const updated = prev.map(algo => ({
					...algo,
					algorithm_locations: algo.algorithm_id === algorithmId
						? [...(algo.algorithm_locations || []), { location_id: locationId }]
						: (algo.algorithm_locations || []).filter(loc => loc.location_id !== locationId)
				}));
				updated.sort((a, b) => a.algorithm_name.localeCompare(b.algorithm_name));
				if (algorithmId) {
					const index = updated.findIndex(a => a.algorithm_id === algorithmId);
					if (index > 0) {
						const [assigned] = updated.splice(index, 1);
						updated.unshift(assigned);
					}
				}
				localStorage.setItem('algorithms', JSON.stringify(updated));
				return updated;
			});
		} catch (error) {
			console.log("assign algorithm error:", error);
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
		if (display || !isAuthenticated) return;
		try {
			await api.delete('/delete_algorithm', {
				data: { algorithmId, locationId }
			});
			setAlgorithms(prev => {
				const updated = prev.filter(a => a.algorithm_id !== algorithmId);
				localStorage.setItem('algorithms', JSON.stringify(updated));
				return updated;
			});
			if (algorithmId === assignedAlgorithmId) setAssignedAlgorithmId('');
			if (editingAlgorithm?.algorithm_id === algorithmId) setEditingAlgorithm(null);
		} catch (error) {
			setError(error.response?.data?.message || 'Failed to delete algorithm');
			setTimeout(() => { setError('') }, 3000);
		}
	};

	const fetchAlgorithms = async () => { 
		try {
			if (display || !isAuthenticated) {
				const welcomeAlgos = await loadWelcomeAlgorithms(); 
            	setAlgorithms(welcomeAlgos);
			} else {
				setError(null);
				setLoading(true);
				let stored = localStorage.getItem('algorithms');
				let algorithmsData = stored ? JSON.parse(stored) : null;
				if (!algorithmsData) {
					const response = await api.get('/get_viewer_algorithms');
					if (response.data.success) {
						algorithmsData = response.data.algorithms;
						localStorage.setItem('algorithms', JSON.stringify(algorithmsData));
					}
				}
				if (algorithmsData) {
					const assigned = algorithmsData.find(a =>
						a?.algorithm_locations?.some(fa => fa?.location_id === locationId)
					);
					const assignedId = assigned ? assigned?.algorithm_id : '';
					const sorted = [...algorithmsData].sort((a, b) => a?.algorithm_name?.localeCompare(b?.algorithm_name));
					if (assignedId) {
						const assignedIndex = sorted.findIndex(a => a?.algorithm_id === assignedId);
						if (assignedIndex > 0) {
							const [assignedAlgo] = sorted.splice(assignedIndex, 1);
							sorted.unshift(assignedAlgo);
						}
					}
					setAlgorithms(sorted);
					setAssignedAlgorithmId(assignedId);
					if (assigned) setEditingAlgorithm(assigned);
				}
			}
		} catch (error) {
			setError(error.response?.data?.message || 'Failed to load algorithms');
			setTimeout(() => { setError('') }, 5000);
		} finally {
			setLoading(false);
		}
	};

	const handleCreated = async newAlgo => {
		if (display || !isAuthenticated) return;
		try {
			const newAlgoWithLocation = {
				...newAlgo,
				algorithm_locations: [{ location_id: locationId }]
			};
			setAlgorithms(prev => {
				const updated = [...prev, newAlgoWithLocation];
				updated.sort((a, b) => a.algorithm_name.localeCompare(b.algorithm_name));
				const index = updated.findIndex(a => a.algorithm_id === newAlgo.algorithm_id);
				if (index > 0) {
					const [created] = updated.splice(index, 1);
					updated.unshift(created);
				}
				localStorage.setItem('algorithms', JSON.stringify(updated));
				return updated;
			});
			setAssignedAlgorithmId(newAlgo?.algorithm_id);
			setEditingAlgorithm(newAlgo);
			await assignAlgorithm(newAlgo?.algorithm_id);
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
		if (display || !isAuthenticated) return;
		try {
			setAssignError(null);
			if (assignedAlgorithmId) {
				await api.delete('/remove_algorithm', {
					data: { algorithmId: assignedAlgorithmId, locationId }
				});	
			}
			setAssignedAlgorithmId('');
			setAlgorithms(prev => {
				const updated = prev.map(algo => ({
					...algo,
					algorithm_locations: (algo.algorithm_locations || []).filter(
						loc => loc.location_id !== locationId
					)
				}));
				localStorage.setItem('algorithms', JSON.stringify(updated));
				return updated;
			});
			setEditingAlgorithm(null);
			refreshPosts();
		} catch (error) {
			setAssignError(error.response?.data?.message || 'Failed to unassign algorithm');
			setTimeout(() => { setAssignError('') }, 3000);
		};
	};

	const updateAlgorithms = updatedAlgo => {
		setAlgorithms(prev => {
			const updated = prev.map(a =>
				a?.algorithm_id === updatedAlgo?.algorithm_id ? updatedAlgo : a
			);
			localStorage.setItem('algorithms', JSON.stringify(updated));
			return updated;
		});
		setEditingAlgorithm(null);
		const originalAlgo = algorithms.find(a => a.algorithm_id === updatedAlgo.algorithm_id);
		const nameChangedOnly = originalAlgo && 
		originalAlgo.algorithm_name !== updatedAlgo.algorithm_name &&
		JSON.stringify({ ...originalAlgo, algorithm_name: undefined }) ===
		JSON.stringify({ ...updatedAlgo, algorithm_name: undefined });
		if (!nameChangedOnly) {
			refreshPosts();
		}
		fetchAlgorithms();
	};

	const renderContent = () => (
		<div className="algorithm-content" onClick={display ? undefined : e => e.stopPropagation()}>
			<div className="selector-header">
				{!display && <button className="small-icon" onClick={closeModal} title="Close">✕<p className="icon-text">Close</p></button>}
				<div className="error-message">{assignError}</div>
				{!display && isAuthenticated && <p className="tiny-text">Changing the algorithm will reload posts</p>}
				{!display && !isAuthenticated && <p className="tiny-text">Login to create an algorithm</p>}
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
									{!display && isAuthenticated && <li key="unassign">
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
									</li>}
									{algorithms.map(a => {
										const isCurrentlyAssigned = a.algorithm_id === assignedAlgorithmId;
										return (
											<li key={a.algorithm_id} className={isCurrentlyAssigned ? 'assigned' : ''}>
												<label onClick={() => selectRadio(a.algorithm_id)} style={{ cursor:'pointer' }}>
													{!display && isAuthenticated && <input
														checked={isCurrentlyAssigned}
														name="algorithm"
														readOnly
														type="radio"
														value={a.algorithm_id}
													/>}		
													{a.algorithm_name}{isCurrentlyAssigned ? ' (assigned)' : ''}
												</label>
												<button
													className="small-icon"
													onClick={e => {
														e.stopPropagation();
														setEditingAlgorithm(a);
														setOptionsOpen(false);
													}}
													title="Edit algorithm"
												><FaEdit /><p className="icon-text">Edit</p></button>
												{!display && isAuthenticated && <button
													className="small-icon"
													onClick={e => {
														e.stopPropagation();
														deleteAlgorithm(a.algorithm_id);
													}}
													title="Delete algorithm"
												><FaTrash /><p className="icon-text">Delete</p></button>}
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</div>
					<AddAlgorithm 
						algorithms={algorithms} 
						display={display}
						editingAlgorithm={editingAlgorithm} 
						isAuthenticated={isAuthenticated}
						locationId={locationId} 
						onCreated={handleCreated} 
						onUpdated={updateAlgorithms} 
						setEditingAlgorithm={setEditingAlgorithm}
					/>
				</>
			)}
			<div className="error-message">{error}</div>
		</div>
	);

	useEffect(() => {
		if (modalOpen || display) fetchAlgorithms();
	}, [modalOpen, display]);

	if (!locationId) return null;

	return (
		<div className="algorithm-selector">
			{!display && (
				<button className="main-button" onClick={() => setModalOpen(true)}>
					<FaSlidersH /><p className="icon-text">Choose algorithm</p>
				</button>
			)}
			{(display || modalOpen) && (
				display ? 
					renderContent() : 
					createPortal(
						<div className="algorithm-overlay" onClick={closeModal}>
							{renderContent()}
						</div>,
						document.body 
					)
			)}
		</div>
	);
};

export default AlgorithmSelector;