import React from 'react';
import { Button } from '@material-ui/core';
import { useDispatch } from 'react-redux';
import { logoutUser } from '../../redux/actions/authActions';

const Logout = () => {
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  return (
    <Button variant="contained" color="secondary" onClick={handleLogout}>
      Logout
    </Button>
  );
};

export default Logout;
