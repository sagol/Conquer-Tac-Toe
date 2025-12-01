import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    FormControlLabel,
    Switch,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Stack,
    Alert
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Download as DownloadIcon,
    ContentCopy as CopyIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import api from '../api';
import './DockerLogs.css';

const DockerLogs = () => {
    const [containers, setContainers] = useState([]);
    const [selectedContainer, setSelectedContainer] = useState('');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Filters
    const [logType, setLogType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [tailLines, setTailLines] = useState(100);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000);

    // Date filters
    const [sinceDate, setSinceDate] = useState('');
    const [untilDate, setUntilDate] = useState('');

    const autoRefreshTimer = useRef(null);
    const logContainerRef = useRef(null);

    // Fetch containers on mount
    useEffect(() => {
        fetchContainers();
    }, []);

    // Auto-refresh logic
    useEffect(() => {
        if (autoRefresh && selectedContainer) {
            autoRefreshTimer.current = setInterval(() => {
                fetchLogs(selectedContainer, false);
            }, autoRefreshInterval);
        } else {
            if (autoRefreshTimer.current) {
                clearInterval(autoRefreshTimer.current);
            }
        }
        return () => {
            if (autoRefreshTimer.current) {
                clearInterval(autoRefreshTimer.current);
            }
        };
    }, [autoRefresh, selectedContainer, autoRefreshInterval]);

    const fetchContainers = async () => {
        try {
            const response = await api.get('/docker/containers');
            setContainers(response.data);
        } catch (err) {
            console.error('Error fetching containers:', err);
            setError('Failed to fetch containers. Make sure Docker socket is accessible.');
        }
    };

    const fetchLogs = async (containerId = selectedContainer, showLoading = true) => {
        if (!containerId) return;

        if (showLoading) setLoading(true);
        setError(null);

        try {
            const params = {
                tail: tailLines,
                timestamps: 'true'
            };

            // Log type filter
            if (logType === 'stdout') {
                params.stdout = 'true';
                params.stderr = 'false';
            } else if (logType === 'stderr') {
                params.stdout = 'false';
                params.stderr = 'true';
            } else {
                params.stdout = 'true';
                params.stderr = 'true';
            }

            // Date filters
            if (sinceDate) {
                params.since = Math.floor(new Date(sinceDate).getTime() / 1000);
            }
            if (untilDate) {
                params.until = Math.floor(new Date(untilDate).getTime() / 1000);
            }

            // Search filter
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            const response = await api.get(`/docker/logs/${containerId}`, { params });
            setLogs(response.data.logs || []);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError(err.response?.data?.message || 'Failed to fetch logs');
            setLogs([]);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleContainerChange = (event) => {
        const containerId = event.target.value;
        setSelectedContainer(containerId);
        if (containerId) {
            fetchLogs(containerId);
        } else {
            setLogs([]);
        }
    };

    const handleRefresh = () => {
        fetchLogs(selectedContainer, true);
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setSinceDate('');
        setUntilDate('');
        setLogType('all');
        setTailLines(100);
    };

    const handleExportLogs = () => {
        if (logs.length === 0) return;

        const containerName = containers.find(c => c.id === selectedContainer)?.name || 'container';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${containerName}_logs_${timestamp}.txt`;

        const logsText = logs.map(log => {
            const timestamp = log.timestamp || '';
            const type = log.type.toUpperCase();
            const message = log.rawMessage;
            return `[${timestamp}] [${type}] ${message}`;
        }).join('\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyLogs = async () => {
        if (logs.length === 0) return;

        const logsText = logs.map(log => {
            const timestamp = log.timestamp || '';
            const type = log.type.toUpperCase();
            const message = log.rawMessage;
            return `[${timestamp}] [${type}] ${message}`;
        }).join('\n');

        try {
            await navigator.clipboard.writeText(logsText);
            // Could add a toast notification here
            alert('Logs copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy logs:', err);
            alert('Failed to copy logs to clipboard');
        }
    };

    const getLogLevelClass = (level) => {
        switch (level) {
            case 'error': return 'log-error';
            case 'warning': return 'log-warning';
            case 'debug': return 'log-debug';
            default: return 'log-info';
        }
    };

    const getContainerStatusColor = (state) => {
        switch (state) {
            case 'running': return 'success';
            case 'exited': return 'error';
            case 'paused': return 'warning';
            default: return 'default';
        }
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Docker Container Logs
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Stack spacing={2}>
                    {/* Container Selection */}
                    <FormControl fullWidth>
                        <InputLabel>Container</InputLabel>
                        <Select
                            value={selectedContainer}
                            onChange={handleContainerChange}
                            label="Container"
                        >
                            <MenuItem value="">
                                <em>Select a container</em>
                            </MenuItem>
                            {containers.map((container) => (
                                <MenuItem key={container.id} value={container.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <span>{container.name}</span>
                                        <Chip
                                            label={container.state}
                                            size="small"
                                            color={getContainerStatusColor(container.state)}
                                        />
                                        <span style={{ fontSize: '0.85em', color: '#666', marginLeft: 'auto' }}>
                                            {container.image}
                                        </span>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Filters Row 1 */}
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                        <FormControl sx={{ minWidth: 150 }}>
                            <InputLabel>Log Type</InputLabel>
                            <Select
                                value={logType}
                                onChange={(e) => setLogType(e.target.value)}
                                label="Log Type"
                            >
                                <MenuItem value="all">All Logs</MenuItem>
                                <MenuItem value="stdout">Stdout Only</MenuItem>
                                <MenuItem value="stderr">Stderr Only</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Tail Lines"
                            type="number"
                            value={tailLines}
                            onChange={(e) => setTailLines(parseInt(e.target.value) || 100)}
                            sx={{ minWidth: 120 }}
                            inputProps={{ min: 10, max: 10000 }}
                        />

                        <TextField
                            label="Search Logs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{ flexGrow: 1, minWidth: 200 }}
                            placeholder="Filter log messages..."
                        />
                    </Stack>

                    {/* Filters Row 2 - Date Range */}
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                        <TextField
                            label="Since Date"
                            type="datetime-local"
                            value={sinceDate}
                            onChange={(e) => setSinceDate(e.target.value)}
                            sx={{ minWidth: 220 }}
                            InputLabelProps={{ shrink: true }}
                        />

                        <TextField
                            label="Until Date"
                            type="datetime-local"
                            value={untilDate}
                            onChange={(e) => setUntilDate(e.target.value)}
                            sx={{ minWidth: 220 }}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Stack>

                    {/* Action Buttons */}
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Button
                            variant="contained"
                            startIcon={<RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={!selectedContainer || loading}
                        >
                            Refresh
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<ClearIcon />}
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </Button>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    disabled={!selectedContainer}
                                />
                            }
                            label="Auto-refresh"
                        />

                        {autoRefresh && (
                            <TextField
                                label="Interval (ms)"
                                type="number"
                                value={autoRefreshInterval}
                                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value) || 5000)}
                                sx={{ width: 150 }}
                                inputProps={{ min: 1000, step: 1000 }}
                                size="small"
                            />
                        )}

                        <Box sx={{ flexGrow: 1 }} />

                        <Tooltip title="Copy to clipboard">
                            <IconButton onClick={handleCopyLogs} disabled={logs.length === 0}>
                                <CopyIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Export logs">
                            <IconButton onClick={handleExportLogs} disabled={logs.length === 0}>
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Paper>

            {/* Logs Display */}
            <Paper sx={{ p: 2, backgroundColor: '#1e1e1e' }}>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                )}

                {!loading && !selectedContainer && (
                    <Typography sx={{ color: '#999', textAlign: 'center', p: 3 }}>
                        Select a container to view logs
                    </Typography>
                )}

                {!loading && selectedContainer && logs.length === 0 && (
                    <Typography sx={{ color: '#999', textAlign: 'center', p: 3 }}>
                        No logs found for the selected filters
                    </Typography>
                )}

                {!loading && logs.length > 0 && (
                    <>
                        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ color: '#aaa', fontSize: '0.9em' }}>
                                Showing {logs.length} log line{logs.length !== 1 ? 's' : ''}
                            </Typography>
                            {autoRefresh && (
                                <Chip
                                    label={`Auto-refreshing every ${autoRefreshInterval / 1000}s`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        <div className="log-container" ref={logContainerRef}>
                            {logs.map((log, index) => (
                                <div key={index} className={`log-line ${getLogLevelClass(log.level)}`}>
                                    <span className="log-type">[{log.type}]</span>
                                    <span className="log-message">{log.rawMessage}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Paper>
        </Box>
    );
};

export default DockerLogs;
