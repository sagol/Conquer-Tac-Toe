import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@material-ui/core';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          Conquer-Tac-Toe
        </Typography>
        <Button color="inherit" component={Link} to="/">
          Home
        </Button>
        <Button color="inherit" component={Link} to="/profile">
          Profile
        </Button>
        <Button color="inherit" component={Link} to="/game-lobby">
          Game Lobby
        </Button>
        <Button color="inherit" component={Link} to="/leaderboard">
          Leaderboard
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
