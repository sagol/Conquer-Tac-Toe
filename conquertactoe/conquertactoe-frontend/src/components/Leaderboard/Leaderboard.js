import React, { useEffect, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import SearchIcon from '@material-ui/icons/Search';
import axios from 'axios';
import '../Common/SharedModernStyles.css';
import './Leaderboard.css';

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState(0); // 0 = PvP, 1 = Bot
  const [pvpLeaderboard, setPvpLeaderboard] = useState([]);
  const [botLeaderboard, setBotLeaderboard] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [playerStats, setPlayerStats] = useState(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Fetch leaderboards
  useEffect(() => {
    fetchPvPLeaderboard();
    fetchBotLeaderboard();
  }, []);

  const fetchPvPLeaderboard = async () => {
    try {
      const res = await axios.get(`${backendUrl}/leaderboard/pvp`, { withCredentials: true });
      setPvpLeaderboard(res.data);
    } catch (error) {
      console.error('Error fetching PvP leaderboard:', error.response?.data || error.message);
    }
  };

  const fetchBotLeaderboard = async () => {
    try {
      const res = await axios.get(`${backendUrl}/leaderboard/bot`, { withCredentials: true });
      setBotLeaderboard(res.data);
    } catch (error) {
      console.error('Error fetching Bot leaderboard:', error.response?.data || error.message);
    }
  };

  //Search for players
  const handleSearchChange = async (event, value) => {

    if (value && value.trim().length > 0) {
      setSearching(true);
      try {
        const res = await axios.get(`${backendUrl}/leaderboard/search`, {
          params: { query: value },
          withCredentials: true
        });
        setSearchResults(res.data);
      } catch (error) {
        console.error('Error searching players:', error);
      } finally {
        setSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Fetch player stats
  const fetchPlayerStats = async (userId) => {
    try {
      const res = await axios.get(`${backendUrl}/leaderboard/player/${userId}`, { withCredentials: true });
      setPlayerStats(res.data);
      setStatsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching player stats:', error.response?.data || error.message);
    } finally {
    }
  };

  const handlePlayerSelect = (event, player) => {
    if (player) {
      fetchPlayerStats(player.user_id);
    }
  };

  const handleRowClick = (userId) => {
    fetchPlayerStats(userId);
  };

  const handleCloseStatsDialog = () => {
    setStatsDialogOpen(false);
    setPlayerStats(null);
  };

  const renderLeaderboardTable = (data) => (
    <TableContainer component={Paper} className="table-container">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell className="col-rank"><strong>Rank</strong></TableCell>
            <TableCell className="col-username"><strong>Username</strong></TableCell>
            <TableCell align="center" className="col-games"><strong>Games</strong></TableCell>
            <TableCell align="center" className="col-wins"><strong>Wins</strong></TableCell>
            <TableCell align="center" className="col-losses"><strong>Losses</strong></TableCell>
            <TableCell align="center" className="col-draws"><strong>Draws</strong></TableCell>
            <TableCell align="center" className="col-winrate"><strong>Win Rate</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((user, index) => (
            <TableRow
              key={user.user_id}
              hover
              onClick={() => handleRowClick(user.user_id)}
              style={{ cursor: 'pointer' }}
              className="clickable-row"
            >
              <TableCell className="col-rank">{index + 1}</TableCell>
              <TableCell className="col-username">{user.username}</TableCell>
              <TableCell align="center" className="col-games">{user.total_games}</TableCell>
              <TableCell align="center" className="col-wins">{user.wins}</TableCell>
              <TableCell align="center" className="col-losses">{user.losses}</TableCell>
              <TableCell align="center" className="col-draws">{user.draws}</TableCell>
              <TableCell align="center" className="col-winrate">{(user.win_rate * 100).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderStatsDialog = () => {
    if (!playerStats) return null;

    return (
      <Dialog open={statsDialogOpen} onClose={handleCloseStatsDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h5">{playerStats.username}'s Statistics</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* PvP Stats */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Player vs Player
                  </Typography>
                  <Box mt={2}>
                    <Typography><strong>Total Games:</strong> {playerStats.pvp_total_games || 0}</Typography>
                    <Typography><strong>Wins:</strong> {playerStats.pvp_wins || 0}</Typography>
                    <Typography><strong>Losses:</strong> {playerStats.pvp_losses || 0}</Typography>
                    <Typography><strong>Draws:</strong> {playerStats.pvp_draws || 0}</Typography>
                    <Typography>
                      <strong>Win Rate:</strong> {((playerStats.pvp_win_rate || 0) * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Bot Stats */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom color="secondary">
                    Player vs AI Bot
                  </Typography>
                  <Box mt={2}>
                    <Typography><strong>Total Games:</strong> {playerStats.bot_total_games || 0}</Typography>
                    <Typography><strong>Wins:</strong> {playerStats.bot_wins || 0}</Typography>
                    <Typography><strong>Losses:</strong> {playerStats.bot_losses || 0}</Typography>
                    <Typography><strong>Draws:</strong> {playerStats.bot_draws || 0}</Typography>
                    <Typography>
                      <strong>Win Rate:</strong> {((playerStats.bot_win_rate || 0) * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Account Info */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Account Information
                  </Typography>
                  <Typography>
                    <strong>Member Since:</strong> {new Date(playerStats.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatsDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-box">
        <h3 className="modern-title">Leaderboard</h3>

        {/* Search Bar */}
        <Box mb={3} mt={2} className="search-box">
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => option.username || ''}
            loading={searching}
            onInputChange={handleSearchChange}
            onChange={handlePlayerSelect}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search for a player"
                variant="outlined"
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="PvP Leaderboard" />
          <Tab label="Bot Leaderboard" />
        </Tabs>

        {/* Tab Panels */}
        <Box mt={3}>
          {activeTab === 0 && renderLeaderboardTable(pvpLeaderboard)}
          {activeTab === 1 && renderLeaderboardTable(botLeaderboard)}
        </Box>

        {/* Stats Dialog */}
        {renderStatsDialog()}
      </div>
    </div>
  );
};

export default Leaderboard;
