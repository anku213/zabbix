import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, Box, Chip,
  TextField, Button, TablePagination
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

const priorityColors = {
  0: 'default',
  1: 'info',
  2: 'warning',
  3: 'error',
  4: 'error',
  5: 'error'
};

const HostPage = () => {
  const { hostid } = useParams();
  const [hostName, setHostName] = useState('');
  const [cpu, setCpu] = useState([]);
  const [uptime, setUptime] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTriggers, setActiveTriggers] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggerForm, setTriggerForm] = useState({ description: '', expression: '', priority: 2 });
  const [cpuPage, setCpuPage] = useState(0);
  const [uptimePage, setUptimePage] = useState(0);
  const [alertsPage, setAlertsPage] = useState(0);
  const [triggersPage, setTriggersPage] = useState(0);
  const [problemsPage, setProblemsPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [history, setHistory] = useState([]); // Combined history: { timestamp, cpu, memory, disk }

  const fetchLatestCpuLoad = async () => {
    try {
      const response = await axios.post('http://localhost:9000/api/zabbix/cpu-load-latest', { hostid });
      return response.data;
    } catch (err) {
      console.error('Error fetching latest CPU load:', err);
      setError('Failed to fetch latest CPU load');
      return [];
    }
  };

  const fetchLatestMemoryUtilization = async () => {
    try {
      const response = await axios.post('http://localhost:9000/api/zabbix/memory-utilization-latest', { hostid });
      return response.data;
    } catch (err) {
      console.error('Error fetching latest memory utilization:', err);
      setError('Failed to fetch latest memory utilization');
      return [];
    }
  };

  const fetchLatestDiskUtilization = async () => {
    try {
      const response = await axios.post('http://localhost:9000/api/zabbix/disk-utilization-latest', { hostid });
      return response.data;
    } catch (err) {
      console.error('Error fetching latest disk utilization:', err);
      setError('Failed to fetch latest disk utilization');
      return [];
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [hostResponse, cpuResponse, cpuLoadResponse, memoryResponse, diskResponse, uptimeResponse, alertsResponse, activeTriggersResponse, problemsResponse] = await Promise.all([
          axios.post('http://localhost:9000/api/zabbix/hosts', { hostids: hostid, output: ['name'] }),
          axios.post('http://localhost:9000/api/zabbix/cpu-load', { hostid }),
          fetchLatestCpuLoad(),
          fetchLatestMemoryUtilization(),
          fetchLatestDiskUtilization(),
          axios.post('http://localhost:9000/api/zabbix/uptime', { hostid }),
          axios.post('http://localhost:9000/api/zabbix/alerts', { hostid }),
          axios.post('http://localhost:9000/api/zabbix/active-triggers', { hostid }),
          axios.post('http://localhost:9000/api/zabbix/problems', { hostid })
        ]);
        setHostName(hostResponse.data[0]?.name || 'Unknown Host');
        setCpu(cpuResponse.data);
        setUptime(uptimeResponse.data);
        setAlerts(alertsResponse.data);
        setActiveTriggers(activeTriggersResponse.data);
        setProblems(problemsResponse.data);
        // Initialize history with synchronized timestamp
        const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        const initialData = {
          timestamp,
          cpu: cpuLoadResponse.length > 0 ? parseFloat(cpuLoadResponse[0].value) : null,
          memory: memoryResponse.length > 0 ? parseFloat(memoryResponse[0].value) : null,
          disk: diskResponse.length > 0 ? parseFloat(diskResponse[0].value) : null
        };
        if (initialData.cpu !== null || initialData.memory !== null || initialData.disk !== null) {
          setHistory([initialData]);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load host details');
        setLoading(false);
        console.error('Error fetching host data:', err);
      }
    };
    fetchData();
  }, [hostid]);

  // Poll data every 1 minute
  useEffect(() => {
    const pollData = async () => {
      const [cpuData, memoryData, diskData] = await Promise.all([
        fetchLatestCpuLoad(),
        fetchLatestMemoryUtilization(),
        fetchLatestDiskUtilization()
      ]);
      const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      const newData = {
        timestamp,
        cpu: cpuData.length > 0 ? parseFloat(cpuData[0].value) : null,
        memory: memoryData.length > 0 ? parseFloat(memoryData[0].value) : null,
        disk: diskData.length > 0 ? parseFloat(diskData[0].value) : null
      };
      if (newData.cpu !== null || newData.memory !== null || newData.disk !== null) {
        setHistory((prev) => [...prev, newData].slice(-60)); // Limit to 1 hour (60 points)
      }
    };

    // Set up polling every 1 minute
    const intervalId = setInterval(pollData, 60000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [hostid]);

  // Manual fetch handlers
  const handleFetchCpuLoad = async () => {
    const data = await fetchLatestCpuLoad();
    if (data.length > 0) {
      const timestamp = new Date((parseInt(data[0].clock) + parseInt(data[0].ns) / 1e9) * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      setHistory((prev) => {
        const lastEntry = prev.length > 0 ? { ...prev[prev.length - 1], cpu: parseFloat(data[0].value), timestamp } : { timestamp, cpu: parseFloat(data[0].value), memory: null, disk: null };
        return [...prev.slice(0, -1), lastEntry].slice(-60);
      });
    }
  };

  const handleFetchMemoryUtilization = async () => {
    const data = await fetchLatestMemoryUtilization();
    if (data.length > 0) {
      const timestamp = new Date((parseInt(data[0].clock) + parseInt(data[0].ns) / 1e9) * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      setHistory((prev) => {
        const lastEntry = prev.length > 0 ? { ...prev[prev.length - 1], memory: parseFloat(data[0].value), timestamp } : { timestamp, cpu: null, memory: parseFloat(data[0].value), disk: null };
        return [...prev.slice(0, -1), lastEntry].slice(-60);
      });
    }
  };

  const handleFetchDiskUtilization = async () => {
    const data = await fetchLatestDiskUtilization();
    if (data.length > 0) {
      const timestamp = new Date((parseInt(data[0].clock) + parseInt(data[0].ns) / 1e9) * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      setHistory((prev) => {
        const lastEntry = prev.length > 0 ? { ...prev[prev.length - 1], disk: parseFloat(data[0].value), timestamp } : { timestamp, cpu: null, memory: null, disk: parseFloat(data[0].value) };
        return [...prev.slice(0, -1), lastEntry].slice(-60);
      });
    }
  };

  // Chart configuration
  const chartData = {
    labels: history.map((data) => data.timestamp),
    datasets: [
      {
        label: 'CPU Load (per core, avg1)',
        data: history.map((data) => data.cpu),
        fill: false,
        borderColor: '#1976d2',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        label: 'Memory Utilization (% available)',
        data: history.map((data) => data.memory),
        fill: false,
        borderColor: '#4caf50',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        label: 'Disk Utilization (% used)',
        data: history.map((data) => data.disk),
        fill: false,
        borderColor: '#f44336',
        tension: 0.1,
        pointRadius: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'System Resource Utilization Over Time' },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 100, // Percentage-based for memory and disk; CPU load may vary
        title: { display: true, text: 'Value' },
      },
      x: {
        title: { display: true, text: 'Time (IST)' },
      },
    },
  };

  const handleTriggerSubmit = async () => {
    try {
      await axios.post('http://localhost:9000/api/zabbix/trigger/create', {
        hostid,
        description: triggerForm.description,
        expression: triggerForm.expression,
        priority: parseInt(triggerForm.priority)
      });
      setTriggerForm({ description: '', expression: '', priority: 2 });
      const response = await axios.post('http://localhost:9000/api/zabbix/active-triggers', { hostid });
      setActiveTriggers(response.data);
    } catch (err) {
      setError('Failed to create trigger');
      console.error('Error creating trigger:', err);
    }
  };

  const handleTriggerStatusUpdate = async (triggerid, status) => {
    try {
      await axios.post('http://localhost:9000/api/zabbix/trigger/update', { triggerid, status });
      const response = await axios.post('http://localhost:9000/api/zabbix/active-triggers', { hostid });
      setActiveTriggers(response.data);
    } catch (err) {
      setError('Failed to update trigger status');
      console.error('Error updating trigger:', err);
    }
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setCpuPage(0);
    setUptimePage(0);
    setAlertsPage(0);
    setTriggersPage(0);
    setProblemsPage(0);
  };

  return (
    <Box className="min-h-screen bg-gray-100 p-6">
      <Typography variant="h4" component="h1" className="text-center mb-6 text-gray-800 font-bold">
        Host: {hostName} (ID: {hostid})
        <Box className="mt-4">
          <Button variant="contained" color="primary" onClick={handleFetchCpuLoad} className="mx-2">
            Fetch CPU Load
          </Button>
          <Button variant="contained" color="primary" onClick={handleFetchMemoryUtilization} className="mx-2">
            Fetch Memory Utilization
          </Button>
          <Button variant="contained" color="primary" onClick={handleFetchDiskUtilization} className="mx-2">
            Fetch Disk Utilization
          </Button>
        </Box>
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
        <>
          <Typography variant="h6" className="mb-4 text-gray-700">System Resource Utilization Over Time</Typography>
          <Box className="max-w-4xl mx-auto mb-8">
            <Paper style={{ padding: '20px' }}>
              {history.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <Typography align="center" color="textSecondary">
                  No resource utilization data available. Please wait for data or fetch manually.
                </Typography>
              )}
            </Paper>
          </Box>

          <Typography variant="h6" className="mb-4 text-gray-700">CPU Load</Typography>
          <StyledTableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell>Last Value</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cpu.length > 0 ? (
                  cpu.slice(cpuPage * rowsPerPage, cpuPage * rowsPerPage + rowsPerPage).map((item) => (
                    <TableRow key={item.itemid} hover>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.lastvalue}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} align="center">No CPU data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={cpu.length}
              rowsPerPage={rowsPerPage}
              page={cpuPage}
              onPageChange={(event, newPage) => setCpuPage(newPage)}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </StyledTableContainer>

          <Typography variant="h6" className="mb-4 mt-8 text-gray-700">Uptime</Typography>
          <StyledTableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell>Uptime</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uptime.length > 0 ? (
                  uptime.slice(uptimePage * rowsPerPage, uptimePage * rowsPerPage + rowsPerPage).map((item) => (
                    <TableRow key={item.itemid} hover>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{formatUptime(item.lastvalue)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} align="center">No uptime data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={uptime.length}
              rowsPerPage={rowsPerPage}
              page={uptimePage}
              onPageChange={(event, newPage) => setUptimePage(newPage)}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </StyledTableContainer>

          <Typography variant="h6" className="mb-4 mt-8 text-gray-700">Alerts</Typography>
          <StyledTableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Description</StyledTableCell>
                  <StyledTableCell>Priority</StyledTableCell>
                  <StyledTableCell>Last Change</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.length > 0 ? (
                  alerts.slice(alertsPage * rowsPerPage, alertsPage * rowsPerPage + rowsPerPage).map((alert, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{alert.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={alert.priority}
                          color={priorityColors[alert.priority] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(alert.lastchange * 1000).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center">No alerts available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={alerts.length}
              rowsPerPage={rowsPerPage}
              page={alertsPage}
              onPageChange={(event, newPage) => setAlertsPage(newPage)}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </StyledTableContainer>

          <Typography variant="h6" className="mb-4 mt-8 text-gray-700">Active Triggers with Dependencies</Typography>
          <StyledTableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Description</StyledTableCell>
                  <StyledTableCell>Priority</StyledTableCell>
                  <StyledTableCell>Expression</StyledTableCell>
                  <StyledTableCell>Last Change</StyledTableCell>
                  <StyledTableCell>Status</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeTriggers.length > 0 ? (
                  activeTriggers.slice(triggersPage * rowsPerPage, triggersPage * rowsPerPage + rowsPerPage).map((trigger) => (
                    <TableRow key={trigger.triggerid} hover>
                      <TableCell>{trigger.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={trigger.priority}
                          color={priorityColors[trigger.priority] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{trigger.expression}</TableCell>
                      <TableCell>
                        {new Date(trigger.lastchange * 1000).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          color={trigger.status === '0' ? 'error' : 'success'}
                          onClick={() => handleTriggerStatusUpdate(trigger.triggerid, trigger.status === '0' ? 1 : 0)}
                        >
                          {trigger.status === '0' ? 'Disable' : 'Enable'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No active triggers available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={activeTriggers.length}
              rowsPerPage={rowsPerPage}
              page={triggersPage}
              onPageChange={(event, newPage) => setTriggersPage(newPage)}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </StyledTableContainer>

          <Typography variant="h6" className="mb-4 mt-8 text-gray-700">Problems</Typography>
          <StyledTableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Event ID</StyledTableCell>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell>Severity</StyledTableCell>
                  <StyledTableCell>Time</StyledTableCell>
                  <StyledTableCell>Acknowledged</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {problems.length > 0 ? (
                  problems.slice(problemsPage * rowsPerPage, problemsPage * rowsPerPage + rowsPerPage).map((problem) => (
                    <TableRow key={problem.eventid} hover>
                      <TableCell>{problem.eventid}</TableCell>
                      <TableCell>{problem.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={problem.severity}
                          color={priorityColors[problem.severity] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(parseInt(problem.clock) * 1000).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {problem.acknowledges.length > 0 ? 'Yes' : 'No'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No problems available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={problems.length}
              rowsPerPage={rowsPerPage}
              page={problemsPage}
              onPageChange={(event, newPage) => setProblemsPage(newPage)}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </StyledTableContainer>

          <Typography variant="h6" className="mb-4 mt-8 text-gray-700">Create New Trigger</Typography>
          <Box className="max-w-md mx-auto p-4 bg-white rounded shadow">
            <TextField
              label="Description"
              value={triggerForm.description}
              onChange={(e) => setTriggerForm({ ...triggerForm, description: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Expression (e.g., last(/{host}/system.cpu.load[percpu,avg1])>5)"
              value={triggerForm.expression}
              onChange={(e) => setTriggerForm({ ...triggerForm, expression: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Priority (0-5)"
              type="number"
              value={triggerForm.priority}
              onChange={(e) => setTriggerForm({ ...triggerForm, priority: e.target.value })}
              fullWidth
              margin="normal"
              inputProps={{ min: 0, max: 5 }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleTriggerSubmit}
              className="mt-4"
              disabled={!triggerForm.description || !triggerForm.expression}
            >
              Create Trigger
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default HostPage;