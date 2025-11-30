import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    FormControlLabel,
    Switch,
    TextField,
    Button,
    Divider,
    Grid,
    Select,
    MenuItem,
    InputLabel,
    Alert,
    Snackbar,
    Tooltip,
    IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import InfoIcon from '@mui/icons-material/Info';
import api from '../api';

const Settings = () => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saveMessage, setSaveMessage] = useState({ open: false, text: '', severity: 'success' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        console.log('[Settings] Fetching settings from API...');
        try {
            const res = await api.get('/settings');
            console.log('[Settings] Received settings:', res.data);
            setSettings(res.data);
            setLoading(false);
            console.log('[Settings] Settings loaded successfully');
        } catch (error) {
            console.error('[Settings] Error fetching settings:', error);
            console.error('[Settings] Error details:', error.response?.data, error.message);
            setLoading(false);
        }
    };

    const handleToggle = async (key) => {
        const currentValue = settings[key].value === 'true';
        const newValue = !currentValue;
        console.log(`[Settings] Toggling ${key}: ${currentValue} -> ${newValue}`);

        try {
            await api.put(`/settings/${key}`, { value: String(newValue) });
            setSettings({
                ...settings,
                [key]: { ...settings[key], value: String(newValue) }
            });
            console.log(`[Settings] Successfully toggled ${key}`);
            showSaveMessage('Setting updated successfully', 'success');
        } catch (error) {
            console.error(`[Settings] Error updating ${key}:`, error);
            showSaveMessage('Failed to update setting', 'error');
        }
    };

    const handleNumberChange = async (key, value) => {
        console.log(`[Settings] Updating number setting ${key} to ${value}`);
        try {
            await api.put(`/settings/${key}`, { value });
            setSettings({
                ...settings,
                [key]: { ...settings[key], value }
            });
            console.log(`[Settings] Successfully updated ${key}`);
            showSaveMessage('Setting updated successfully', 'success');
        } catch (error) {
            console.error(`[Settings] Error updating ${key}:`, error);
            showSaveMessage('Failed to update setting', 'error');
        }
    };

    const handleSelectChange = async (key, value) => {
        console.log(`[Settings] Updating select setting ${key} to ${value}`);
        try {
            await api.put(`/settings/${key}`, { value });
            setSettings({
                ...settings,
                [key]: { ...settings[key], value }
            });
            console.log(`[Settings] Successfully updated ${key}`);
            showSaveMessage('Setting updated successfully', 'success');
        } catch (error) {
            console.error(`[Settings] Error updating ${key}:`, error);
            showSaveMessage('Failed to update setting', 'error');
        }
    };

    const showSaveMessage = (text, severity) => {
        setSaveMessage({ open: true, text, severity });
    };

    const handleCloseMessage = () => {
        setSaveMessage({ ...saveMessage, open: false });
    };

    const renderBooleanSetting = (key, label) => {
        if (!settings[key]) return null;
        return (
            <Tooltip title={settings[key].description} placement="right" arrow>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings[key].value === 'true'}
                            onChange={() => handleToggle(key)}
                            color="primary"
                        />
                    }
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">{label}</Typography>
                            <InfoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </Box>
                    }
                />
            </Tooltip>
        );
    };

    const renderNumberSetting = (key, label) => {
        if (!settings[key]) return null;
        return (
            <Box sx={{ mb: 2 }}>
                <TextField
                    fullWidth
                    type="number"
                    label={label}
                    value={settings[key].value || '0'}
                    onChange={(e) => setSettings({
                        ...settings,
                        [key]: { ...settings[key], value: e.target.value }
                    })}
                    onBlur={(e) => handleNumberChange(key, e.target.value)}
                    helperText={settings[key].description}
                    InputProps={{ inputProps: { min: 0 } }}
                />
            </Box>
        );
    };

    const renderSelectSetting = (key, label, options) => {
        if (!settings[key]) return null;
        return (
            <Box sx={{ mb: 2 }}>
                <FormControl fullWidth>
                    <InputLabel>{label}</InputLabel>
                    <Select
                        value={settings[key].value}
                        label={label}
                        onChange={(e) => handleSelectChange(key, e.target.value)}
                    >
                        {options.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Typography variant="caption" color="textSecondary">
                    {settings[key].description}
                </Typography>
            </Box>
        );
    };

    if (loading) {
        return <Typography>Loading settings...</Typography>;
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Site Settings</Typography>

            <Grid container spacing={3}>
                {/* Development & Debugging */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Development & Debugging</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {renderBooleanSetting('ENABLE_DEV_LOGIN', 'Enable Dev Login')}
                        {renderBooleanSetting('dev_logging', 'Dev Logging')}
                        {renderBooleanSetting('debug_mode', 'Debug Mode')}
                    </Paper>
                </Grid>

                {/* Site Operations */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Site Operations</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {renderBooleanSetting('maintenance_mode', 'Maintenance Mode')}
                        {renderBooleanSetting('new_registrations', 'New Registrations')}
                        {renderBooleanSetting('game_creation', 'Game Creation')}
                    </Paper>
                </Grid>

                {/* Gameplay Settings */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Gameplay Settings</Typography>
                        <Divider sx={{ mb: 2 }} />

                        {/* Bot Difficulty by Game Type */}
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                            Bot Difficulty by Game Type
                        </Typography>
                        {renderSelectSetting('bot_difficulty_variant_1', 'Classic Tic-Tac-Toe', ['easy', 'medium', 'hard'])}
                        {renderSelectSetting('bot_difficulty_variant_2', 'Gomoku (5-in-Line)', ['easy', 'medium', 'hard'])}
                        {renderSelectSetting('bot_difficulty_variant_3', 'Conquer Classic', ['easy', 'medium', 'hard'])}
                        {renderSelectSetting('bot_difficulty_variant_4', 'Conquer Same-Size', ['easy', 'medium', 'hard'])}
                        {renderSelectSetting('bot_difficulty_variant_5', 'Conquer Custom', ['easy', 'medium', 'hard'])}

                        <Divider sx={{ my: 2 }} />
                        {renderNumberSetting('max_active_games_per_user', 'Max Active Games Per User')}
                    </Paper>
                </Grid>

                {/* Performance & Security */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Performance & Security</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {renderNumberSetting('rate_limit_per_min', 'Rate Limit (requests/min)')}
                        {renderNumberSetting('session_timeout_minutes', 'Session Timeout (minutes)')}
                    </Paper>
                </Grid>
            </Grid>

            <Snackbar
                open={saveMessage.open}
                autoHideDuration={3000}
                onClose={handleCloseMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseMessage} severity={saveMessage.severity}>
                    {saveMessage.text}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Settings;
