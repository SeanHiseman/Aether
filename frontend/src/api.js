import axios from 'axios';

const api = axios.create({
	baseURL: '/api',
	withCredentials: true
});

api.interceptors.response.use(
	response => response,
	error => {
		if (error.response && error.response.status === 429) {
			alert(error.response.data?.message || 'Too many requests. Please slow down.');
		}
		return Promise.reject(error);
	}
);

export default api;