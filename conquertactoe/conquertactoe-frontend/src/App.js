import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'react-redux';
import store from './redux/store';
import theme from './theme';
import axios from 'axios';
import Navbar from './components/Common/Navbar';
import Login from './components/Auth/Login';
import Banned from './components/Auth/Banned';
import Maintenance from './components/Maintenance/Maintenance';
import Profile from './components/Profile/Profile';
import Lobby from './components/Lobby/Lobby';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Home from './components/Home/Home';
import Rules from './components/Rules/Rules';
import GamePage from './components/Game/GamePage';
import { fetchCurrentUser } from './redux/actions/authActions';


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
          <Navbar />
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
        </Router>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
