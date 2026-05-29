import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import apiClient, { getToken } from '../services/apiClient';

/**
 * Hook to track AI generation jobs using SSE or Polling.
 */
export const useAIJobStatus = (jobId) => {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [jobConfig, setJobConfig] = useState({});

  useEffect(() => {
    if (!jobId) return;

    let eventSource = null;
    let pollInterval = null;

    const setupStream = async () => {
      // Get job config from server to decide whether to use SSE or polling
      let useSSE = true;
      try {
        const initial = await apiClient.get(API_ENDPOINTS.AI_JOB_STATUS(jobId));
        setStatus(initial.status);
        setProgress(initial.progress || 0);
        if (initial.result) setResult(initial.result);
        if (initial.error) setError(initial.error);
        setJobConfig(initial.config || {});
        if (initial.config && initial.config.use_sse === false) {
          useSSE = false;
        }
      } catch (err) {
        // ignore initial fetch errors and fall back to SSE
      }

      if (useSSE) {
        const token = await getToken();
        const url = `${API_BASE_URL}${API_ENDPOINTS.AI_JOB_STREAM(jobId)}?token=${encodeURIComponent(token || '')}`;
        eventSource = new EventSource(url);

        eventSource.addEventListener('update', (event) => {
          const data = JSON.parse(event.data);
          setStatus(data.status);
          setProgress(data.progress || 0);
          if (data.config) setJobConfig(data.config || {});
          if (data.status === 'ready') {
            setResult(data.result);
            setIsReady(true);
            eventSource.close();
          }
          if (data.status === 'failed') {
            setError(data.error || 'Job failed');
            eventSource.close();
          }
        });

        eventSource.addEventListener('error', (event) => {
          console.error('SSE Error:', event);
          // fallback to polling
          if (eventSource) {
            try { eventSource.close(); } catch (e) {}
            eventSource = null;
          }
        });

      }

      // Polling fallback or if SSE closed
      const startPolling = () => {
        const poll = async () => {
          try {
            const res = await apiClient.get(API_ENDPOINTS.AI_JOB_STATUS(jobId));
            setStatus(res.status);
            setProgress(res.progress || 0);
            if (res.config) setJobConfig(res.config || {});
            if (res.status === 'ready') {
              setResult(res.result);
              setIsReady(true);
              clearInterval(pollInterval);
            }
            if (res.status === 'failed') {
              setError(res.error || 'Job failed');
              clearInterval(pollInterval);
            }
          } catch (err) {
            setError(err.message);
            clearInterval(pollInterval);
          }
        };

        poll();
        const intervalMs = (jobConfig && jobConfig.poll_interval) ? jobConfig.poll_interval : 3000;
        pollInterval = setInterval(poll, intervalMs);
      };

      // If SSE is not used or EventSource not supported, start polling
      if (!useSSE || typeof EventSource === 'undefined') {
        startPolling();
      } else {
        // If SSE failed to connect, after a short delay, start polling
        setTimeout(() => {
          if (!eventSource || eventSource.readyState === 2) {
            startPolling();
          }
        }, 1500);
      }
    };

    setupStream();

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId]);

  const stopJob = useCallback(async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AI_JOB_STOP(jobId));
      setStatus('stopping');
    } catch (err) {
      setError(err.message || 'Failed to stop job');
    }
  }, [jobId]);

  const retryJob = useCallback(async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AI_JOB_RETRY(jobId));
      setStatus('pending');
      setProgress(0);
      setError(null);
      setResult(null);
    } catch (err) {
      setError(err.message || 'Failed to retry job');
    }
  }, [jobId]);

  const updateConfig = useCallback(async (cfg) => {
    try {
      const res = await apiClient.patch(API_ENDPOINTS.AI_JOB_CONFIG(jobId), cfg);
      setJobConfig(res.config || cfg);
      return res;
    } catch (err) {
      setError(err.message || 'Failed to update job config');
      throw err;
    }
  }, [jobId]);

  return { status, progress, result, error, isReady, stopJob, retryJob, updateConfig, config: jobConfig };
};
