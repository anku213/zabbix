import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import HostPage from './components/HostPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/host/:hostid" element={<HostPage />} />
      </Routes>
    </Router>
  );
};

export default App;
