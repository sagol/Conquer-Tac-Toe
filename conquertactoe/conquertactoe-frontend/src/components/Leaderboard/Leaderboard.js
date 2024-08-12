import React, { useEffect, useState } from 'react';
import { Container, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@material-ui/core';
import axios from 'axios';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/leaderboard`, { withCredentials: true });
        setLeaderboard(res.data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error.response?.data || error.message);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <Container className="leaderboard-container">
      <Box className="leaderboard-box">
        <TableContainer component={Paper} className="table-container">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Wins</TableCell>
                <TableCell>Losses</TableCell>
                <TableCell>Draws</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard.map((user, index) => (
                <TableRow key={user.user_id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.wins}</TableCell>
                  <TableCell>{user.losses}</TableCell>
                  <TableCell>{user.draws}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
};

export default Leaderboard;
