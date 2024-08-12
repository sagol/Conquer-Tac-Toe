import React from 'react';
import { Container, Box, Typography, Card, CardContent } from '@material-ui/core';

const Home = () => {
  return (
    <Container>
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" mt={5}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Welcome to Conquer-Tac-Toe!
            </Typography>
            <Typography variant="body1" paragraph>
              Conquer-Tac-Toe is a strategic twist on the classic tic-tac-toe game.
            </Typography>
            <Typography variant="h6" gutterBottom>
              Game Rules:
            </Typography>
            <Typography variant="body1" paragraph>
              1. Each player has a limited number of cones of 3 sizes.
            </Typography>
            <Typography variant="body1" paragraph>
              2. Each player has their own color.
            </Typography>
            <Typography variant="body1" paragraph>
              3. Players can overlap opponents' cones only with bigger size cones.
            </Typography>
            <Typography variant="body1" paragraph>
              4. Other rules are the same as in the original tic-tac-toe.
            </Typography>
            <Typography variant="h6" gutterBottom>
              Objective:
            </Typography>
            <Typography variant="body1" paragraph>
              The objective is to align three of your cones in a row, column, or diagonal.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Home;
