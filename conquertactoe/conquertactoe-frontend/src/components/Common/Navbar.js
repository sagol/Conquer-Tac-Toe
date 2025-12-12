import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  useMediaQuery,
  useTheme,
  Divider
} from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import CloseIcon from '@material-ui/icons/Close';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../../redux/actions/authActions';
import NotificationIconButton from '../Notifications/NotificationIconButton';
import './Navbar.css';

const Navbar = () => {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleLogout = () => {
    dispatch(logoutUser());
    setMobileOpen(false);
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const navItems = [
    { label: 'Home', path: '/', showAlways: true },
    { label: 'Rules', path: '/rules', showAlways: true },
    { label: 'Leaderboard', path: '/leaderboard', showAlways: true },
    { label: 'Profile', path: '/profile', showWhenLoggedIn: true },
    { label: 'Lobby', path: '/lobby', showWhenLoggedIn: true },
  ];

  const drawer = (
    <div className="mobile-drawer">
      <div className="drawer-header">
        <Typography variant="h6">Menu</Typography>
        <IconButton onClick={handleDrawerToggle} aria-label="Close menu">
          <CloseIcon />
        </IconButton>
      </div>
      <Divider />
      <List>
        {navItems.map((item) => {
          if (item.showWhenLoggedIn && !user) return null;
          return (
            <ListItem
              button
              key={item.label}
              component={Link}
              to={item.path}
              onClick={handleNavClick}
              className="drawer-item"
            >
              <ListItemText primary={item.label} />
            </ListItem>
          );
        })}
        <Divider />
        {user ? (
          <ListItem button onClick={handleLogout} className="drawer-item logout-item">
            <ListItemText primary="Logout" />
          </ListItem>
        ) : (
          <ListItem
            button
            component={Link}
            to="/login"
            onClick={handleNavClick}
            className="drawer-item"
          >
            <ListItemText primary="Login" />
          </ListItem>
        )}
      </List>
    </div>
  );

  return (
    <>
      <AppBar position="static" component="nav" aria-label="Main Navigation" className="navbar">
        <Toolbar>
          <Typography variant="h6" component="h1" className="navbar-title">
            Conquer-Tac-Toe
          </Typography>

          {isMobile ? (
            <>
              {user && <NotificationIconButton />}
              <IconButton
                color="inherit"
                aria-label="Open navigation menu"
                edge="end"
                onClick={handleDrawerToggle}
                className="menu-button"
              >
                <MenuIcon />
              </IconButton>
            </>
          ) : (
            <>
              <Button color="inherit" component={Link} to="/" aria-label="Home">Home</Button>
              <Button color="inherit" component={Link} to="/rules" aria-label="Rules">Rules</Button>
              <Button color="inherit" component={Link} to="/leaderboard" aria-label="Leaderboard">Leaderboard</Button>
              {user ? (
                <>
                  <Button color="inherit" component={Link} to="/profile" aria-label="Profile">Profile</Button>
                  <Button color="inherit" component={Link} to="/lobby" aria-label="Lobby">Lobby</Button>
                  <NotificationIconButton />
                  <Button color="inherit" onClick={handleLogout} aria-label="Logout">Logout</Button>
                </>
              ) : (
                <Button color="inherit" component={Link} to="/login" aria-label="Login">Login</Button>
              )}
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        classes={{ paper: 'drawer-paper' }}
        ModalProps={{ keepMounted: true }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Navbar;
