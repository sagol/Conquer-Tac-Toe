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
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const createBotGame = async () => {
    try {
      // Check if user is authenticated first
      const userCheck = await axios.get(`${backendUrl}/current_user`, { withCredentials: true });
      if (!userCheck.data || !userCheck.data.user_id) {
        navigate('/login');
        return;
      }

      const res = await axios.post(`${backendUrl}/game-requests/bot`, {}, { withCredentials: true });
      navigate(`/game/${res.data.id}`);
    } catch (error) {
      // If unauthorized, redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/login');
      } else {
        alert(error.response?.data?.error || 'Failed to create bot game');
      }
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
                onClick={createBotGame}
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
                            onClick={createBotGame}
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

      {/* How to Play Section */}
      <section className="how-to-play-section">
        <Container maxWidth="lg">
          <Typography variant="h4" className="section-title" align="center" gutterBottom>
            How to Play
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card className="feature-card">
                <CardContent>
                  <Typography variant="h3" className="feature-number">1</Typography>
                  <Typography variant="h6" gutterBottom>Choose Your C one</Typography>
                  <Typography variant="body2">
                    Each player has cones of 3 different sizes. Select wisely based on your strategy!
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card className="feature-card">
                <CardContent>
                  <Typography variant="h3" className="feature-number">2</Typography>
                  <Typography variant="h6" gutterBottom>Strategic Placement</Typography>
                  <Typography variant="body2">
                    Place cones on the board. You can cover opponent's cones with larger ones!
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card className="feature-card">
                <CardContent>
                  <Typography variant="h3" className="feature-number">3</Typography>
                  <Typography variant="h6" gutterBottom>Win the Game</Typography>
                  <Typography variant="body2">
                    Get three of your cones in a row (horizontal, vertical, or diagonal) to win!
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </section>
    </div>
  );
};

export default Home;
