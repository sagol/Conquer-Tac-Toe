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
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../../redux/actions/authActions';
import NotificationIconButton from '../Notifications/NotificationIconButton';
import './Navbar.css';

const Navbar = () => {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
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

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
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
              className={`drawer-item ${isActive(item.path) ? 'nav-active' : ''}`}
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
            className={`drawer-item ${isActive('/login') ? 'nav-active' : ''}`}
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
              <Button
                color="inherit"
                component={Link}
                to="/"
                aria-label="Home"
                className={isActive('/') ? 'nav-active' : ''}
              >Home</Button>
              <Button
                color="inherit"
                component={Link}
                to="/rules"
                aria-label="Rules"
                className={isActive('/rules') ? 'nav-active' : ''}
              >Rules</Button>
              <Button
                color="inherit"
                component={Link}
                to="/leaderboard"
                aria-label="Leaderboard"
                className={isActive('/leaderboard') ? 'nav-active' : ''}
              >Leaderboard</Button>
              {user ? (
                <>
                  <Button
                    color="inherit"
                    component={Link}
                    to="/profile"
                    aria-label="Profile"
                    className={isActive('/profile') ? 'nav-active' : ''}
                  >Profile</Button>
                  <Button
                    color="inherit"
                    component={Link}
                    to="/lobby"
                    aria-label="Lobby"
                    className={isActive('/lobby') ? 'nav-active' : ''}
                  >Lobby</Button>
                  <NotificationIconButton />
                  <Button color="inherit" onClick={handleLogout} aria-label="Logout">Logout</Button>
                </>
              ) : (
                <Button
                  color="inherit"
                  component={Link}
                  to="/login"
                  aria-label="Login"
                  className={isActive('/login') ? 'nav-active' : ''}
                >Login</Button>
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
