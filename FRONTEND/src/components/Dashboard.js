import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  margin: '20px auto',
  maxWidth: '1200px',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.contrastText,
}));

const StyledLink = styled(Link)(({ theme }) => ({
  textDecoration: 'none',
  color: theme.palette.primary.main,
  '&:hover': {
    textDecoration: 'underline',
    color: theme.palette.primary.dark,
  },
}));

const Dashboard = () => {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHostsAndCounts = async () => {
      try {
        setLoading(true);
        const hostsResponse = await axios.post('http://localhost:9000/api/zabbix/hosts');
        const hostsData = hostsResponse.data;

        // Fetch counts for triggers, alerts, and problems for each host
        const hostPromises = hostsData.map(async (host) => {
          const [triggersResponse, alertsResponse, problemsResponse] = await Promise.all([
            axios.post('http://localhost:9000/api/zabbix/active-triggers', { hostid: host.hostid }),
            axios.post('http://localhost:9000/api/zabbix/alerts', { hostid: host.hostid }),
            axios.post('http://localhost:9000/api/zabbix/problems', { hostid: host.hostid })
          ]);
          return {
            ...host,
            triggerCount: triggersResponse.data.length,
            alertCount: alertsResponse.data.length,
            problemCount: problemsResponse.data.length
          };
        });

        const hostsWithCounts = await Promise.all(hostPromises);
        setHosts(hostsWithCounts);
        setLoading(false);
      } catch (err) {
        setError('Failed to load hosts or counts');
        setLoading(false);
        console.error('Failed to load hosts or counts:', err);
      }
    };
    fetchHostsAndCounts();
  }, []);

  return (
    <Box className="min-h-screen bg-gray-100 p-6">
      <Typography variant="h4" component="h1" className="text-center mb-6 text-gray-800 font-bold">
        Zabbix Hosts Dashboard
      </Typography>
      {loading ? (
        <Box className="flex justify-center items-center h-64">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error" className="text-center">
          {error}
        </Typography>
      ) : (
        <StyledTableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <StyledTableCell>Host Name</StyledTableCell>
                <StyledTableCell>Host ID</StyledTableCell>
                <StyledTableCell>Triggers</StyledTableCell>
                <StyledTableCell>Alerts</StyledTableCell>
                <StyledTableCell>Problems</StyledTableCell>
                <StyledTableCell>Action</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hosts.map((host) => (
                <TableRow key={host.hostid} hover>
                  <TableCell>{host.name}</TableCell>
                  <TableCell>{host.hostid}</TableCell>
                  <TableCell>{host.triggerCount}</TableCell>
                  <TableCell>{host.alertCount}</TableCell>
                  <TableCell>{host.problemCount}</TableCell>
                  <TableCell>
                    <StyledLink to={`/host/${host.hostid}`}>
                      View Details
                    </StyledLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}
    </Box>
  );
};

export default Dashboard;