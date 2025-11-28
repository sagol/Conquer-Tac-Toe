import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@material-ui/core';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import SportsEsportsIcon from '@material-ui/icons/SportsEsports';
import PeopleIcon from '@material-ui/icons/People';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import AndroidIcon from '@material-ui/icons/Android';
import CreateGameModal from '../Lobby/CreateGameModal';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      const res = await axios.get(`${backendUrl}/stats/global`);
      setStats(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    try {
      // Check if user is authenticated first
      const userCheck = await axios.get(`${backendUrl}/current_user`, { withCredentials: true });
      if (!userCheck.data || !userCheck.data.user_id) {
        navigate('/login');
        return;
      }
      setShowCreateModal(true);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/login');
      }
    }
  };

  const handleCreateGame = async (gameData) => {
    try {
      let res;
      if (gameData.gameType === 'bot') {
        // Send complete gameData to include boardSize, customCones, etc.
        res = await axios.post(`${backendUrl}/game-requests/bot`, gameData, { withCredentials: true });
      } else {
        res = await axios.post(`${backendUrl}/game-requests`, gameData, { withCredentials: true });
      }
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create game');
    }
  };

  const navigateToLobby = async () => {
    try {
      // Check if user is authenticated before going to lobby
      const userCheck = await axios.get(`${backendUrl}/current_user`, { withCredentials: true });
      if (!userCheck.data || !userCheck.data.user_id) {
        navigate('/login');
        return;
      }
      navigate('/lobby');
    } catch (error) {
      // If unauthorized, redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/login');
      } else {
        navigate('/lobby');
      }
    }
  };

  return (
    <div className="modern-home">
      {/* Create Game Modal */}
      <CreateGameModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateGame}
      />

      {/* Hero Section */}
      <section className="hero-section">
        <Container maxWidth="lg">
          <Box className="hero-content">
            <Typography variant="h2" className="hero-title" gutterBottom>
              Conquer Tac-Toe
            </Typography>
            <Typography variant="h5" className="hero-subtitle" gutterBottom>
              Strategic Tic-Tac-Toe with a Twist
            </Typography>
            <Typography variant="body1" className="hero-description" paragraph>
              Master the game where size matters! Use different sized cones to conquer the board
              and outsmart your opponents.
            </Typography>
            <Box className="hero-buttons" mt={4}>
              <Button
                variant="contained"
                className="btn-primary btn-large"
                onClick={handleOpenCreateModal}
                startIcon={<AndroidIcon />}
              >
                Play vs AI
              </Button>
              <Button
                variant="outlined"
                className="btn-secondary btn-large"
                onClick={navigateToLobby}
                startIcon={<PeopleIcon />}
              >
                Play vs Human
              </Button>
            </Box>
          </Box>
        </Container>
      </section>

      {/* Global Stats Section */}
      <section className="stats-section">
        <Container maxWidth="lg">
          <Typography variant="h4" className="section-title" align="center" gutterBottom>
            Live Statistics
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3} className="stats-grid">
              {/* Total Games */}
              <Grid item xs={12} sm={6} md={3}>
                <Card className="stat-card glass-card">
                  <CardContent className="stat-content">
                    <SportsEsportsIcon className="stat-icon" style={{ color: '#FF6B6B' }} />
                    <Typography variant="h3" className="stat-number">
                      {stats?.total_games || 0}
                    </Typography>
                    <Typography variant="body2" className="stat-label">
                      Total Games Played
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Players */}
              <Grid item xs={12} sm={6} md={3}>
                <Card className="stat-card glass-card">
                  <CardContent className="stat-content">
                    <PeopleIcon className="stat-icon" style={{ color: '#4ECDC4' }} />
                    <Typography variant="h3" className="stat-number">
                      {stats?.total_users || 0}
                    </Typography>
                    <Typography variant="body2" className="stat-label">
                      Registered Players
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Active Games */}
              <Grid item xs={12} sm={6} md={3}>
                <Card className="stat-card glass-card">
                  <CardContent className="stat-content">
                    <TrendingUpIcon className="stat-icon" style={{ color: '#FFE66D' }} />
                    <Typography variant="h3" className="stat-number">
                      {stats?.active_games || 0}
                    </Typography>
                    <Typography variant="body2" className="stat-label">
                      Games in Progress
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Games Today */}
              <Grid item xs={12} sm={6} md={3}>
                <Card className="stat-card glass-card">
                  <CardContent className="stat-content">
                    <SportsEsportsIcon className="stat-icon" style={{ color: '#A8E6CF' }} />
                    <Typography variant="h3" className="stat-number">
                      {stats?.games_today || 0}
                    </Typography>
                    <Typography variant="body2" className="stat-label">
                      Games Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Container>
      </section>

      {/* AI Bot Section */}
      <section className="ai-section">
        <Container maxWidth="lg">
          <Card className="ai-card gradient-card">
            <CardContent className="ai-content">
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Box className="ai-info">
                    <AndroidIcon className="ai-icon-large" />
                    <Typography variant="h4" className="ai-title" gutterBottom>
                      Challenge Our AI
                    </Typography>
                    <Typography variant="body1" paragraph>
                      Test your skills against our intelligent bot! Perfect for practice or
                      when you want a quick game.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box className="ai-stats-box">
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box className="ai-stat-item">
                          <Typography variant="h4" className="ai-stat-number">
                            {stats?.bot_games || 0}
                          </Typography>
                          <Typography variant="body2" className="ai-stat-label">
                            Bot Games Played
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box className="ai-stat-item">
                          <Typography variant="h4" className="ai-stat-number">
                            {stats?.player_win_rate || 0}%
                          </Typography>
                          <Typography variant="body2" className="ai-stat-label">
                            Player Win Rate
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box className="ai-stat-item">
                          <Typography variant="h4" className="ai-stat-number">
                            {stats?.bot_win_rate || 0}%
                          </Typography>
                          <Typography variant="body2" className="ai-stat-label">
                            Bot Win Rate
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box className="ai-stat-item">
                          <Button
                            variant="contained"
                            fullWidth
                            className="btn-ai-challenge"
                            onClick={handleOpenCreateModal}
                          >
                            Try Now!
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Container>
      </section>

      {/* Game Variants Section */}
      <section className="how-to-play-section">
        <Container maxWidth="lg">
          <Typography variant="h4" className="section-title" align="center" gutterBottom>
            Game Modes
          </Typography>
          <Typography variant="h6" align="center" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '40px' }}>
            Click on a card to learn the rules!
          </Typography>

          <Grid container spacing={3} justifyContent="center">
            {[
              { title: "Classic Tic-Tac-Toe", desc: "The traditional 3x3 game. Simple and timeless.", id: "classic" },
              { title: "5-in-Line (Gomoku)", desc: "Strategy on a large board. Connect 5 to win.", id: "gomoku" },
              { title: "Conquer Classic", desc: "3x3 with cone sizes. Larger covers smaller!", id: "conquer-classic" },
              { title: "Conquer Same-Size", desc: "Aggressive play! Equal sizes can overwrite.", id: "conquer-same" },
              { title: "Conquer Custom", desc: "Build your own loadout of cones.", id: "conquer-custom" }
            ].map((variant, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  className="feature-card variant-card"
                  onClick={() => navigate('/rules')}
                  style={{ cursor: 'pointer' }}
                >
                  <CardContent>
                    <Typography variant="h5" gutterBottom style={{ color: '#FFB74D', fontWeight: 'bold' }}>
                      {variant.title}
                    </Typography>
                    <Typography variant="body2">
                      {variant.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box textAlign="center" mt={6}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/rules')}
              className="btn-rules"
            >
              View Detailed Rules & Examples
            </Button>
          </Box>
        </Container>
      </section>
    </div>
  );
};

export default Home;
