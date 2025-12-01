import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'react-redux';
import store from './redux/store';
import theme from './theme';
import axios from 'axios';
import Navbar from './components/Common/Navbar';
import { CircularProgress, Box } from '@material-ui/core';
import { fetchCurrentUser } from './redux/actions/authActions';
import { NotificationProvider } from './context/NotificationContext';
import NotificationToast from './components/Notifications/NotificationToast';

// Lazy load components for performance
const Login = lazy(() => import('./components/Auth/Login'));
const Banned = lazy(() => import('./components/Auth/Banned'));
const Maintenance = lazy(() => import('./components/Maintenance/Maintenance'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const Lobby = lazy(() => import('./components/Lobby/Lobby'));
const Leaderboard = lazy(() => import('./components/Leaderboard/Leaderboard'));
const Home = lazy(() => import('./components/Home/Home'));
const Rules = lazy(() => import('./components/Rules/Rules'));
const GamePage = lazy(() => import('./components/Game/GamePage'));


const App = () => {
  const dispatch = useDispatch();
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    // Check for maintenance mode on API errors
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 503 && error.response?.data?.error?.includes('maintenance')) {
          setMaintenanceMode(true);
        }
        return Promise.reject(error);
      }
    );

    dispatch(fetchCurrentUser());
  }, [dispatch]);

  if (maintenanceMode) {
    return <Maintenance />;
  }

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <Router>
          <NotificationProvider>
            <Navbar />
            <NotificationToast />
            <Suspense fallback={
              <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
              </Box>
            }>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/banned" element={<Banned />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/lobby" element={<Lobby />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/rules" element={<Rules />} />
                <Route path="/game/:gameId" element={<GamePage />} />
              </Routes>
            </Suspense>
          </NotificationProvider>
        </Router>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
