import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const listSessions = () => api.get("/sessions").then((r) => r.data);
export const getSession = (id) => api.get(`/sessions/${id}`).then((r) => r.data);
export const createSession = (data) => api.post("/sessions", data).then((r) => r.data);
export const updateSession = (id, data) => api.put(`/sessions/${id}`, data).then((r) => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`).then((r) => r.data);
export const setPlayerPaid = (sessionId, playerId, paid) =>
  api.patch(`/sessions/${sessionId}/players/${playerId}`, { paid }).then((r) => r.data);

export const uploadQr = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload-qr", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const fileUrl = (path) => (path ? `${API}/files/${path}` : "");
