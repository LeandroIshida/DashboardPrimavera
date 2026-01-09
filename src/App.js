// src/App.js
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Dashboard from './pages/Dashboard';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Se acessar só "/", redireciona para /dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Rota oficial do dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Se vier com D maiúsculo, também funciona */}
        <Route path="/Dashboard" element={<Navigate to="/dashboard" replace />} />

        {/* Qualquer coisa estranha manda de volta pro dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
