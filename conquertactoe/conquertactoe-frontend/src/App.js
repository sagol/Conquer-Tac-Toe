import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'react-redux';
import store from './redux/store';
import theme from './theme';
import Navbar from './components/Common/Navbar';
import Login from './components/Auth/Login';
import Profile from './components/Profile/Profile';
import Lobby from './components/Lobby/Lobby';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Home from './components/Home/Home';
import GamePage from './components/Game/GamePage';
import { fetchCurrentUser } from './redux/actions/authActions';


const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/game/:gameId" element={<GamePage />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
