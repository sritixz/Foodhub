import api from '../utils/api';

export const getMenuLeads = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  return api.get(`/leads/menu-leads?${params.toString()}`);
};

export const getFranchiseRequests = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.city) params.append('city', filters.city);
  if (filters.search) params.append('search', filters.search);
  return api.get(`/leads/franchise-requests?${params.toString()}`);
};

export const getNewsletterSubscribers = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  return api.get(`/leads/newsletter-subscribers?${params.toString()}`);
};

export const updateMenuLead = (id, payload) => {
  return api.patch(`/leads/menu-leads/${id}`, payload);
};

export const updateFranchiseRequest = (id, payload) => {
  return api.patch(`/leads/franchise-requests/${id}`, payload);
};

export const updateNewsletterSubscriber = (id, payload) => {
  return api.patch(`/leads/newsletter-subscribers/${id}`, payload);
};
