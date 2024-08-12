import React from 'react';
import { Container as MuiContainer } from '@material-ui/core';

const Container = ({ children }) => {
  return <MuiContainer maxWidth="lg">{children}</MuiContainer>;
};

export default Container;
