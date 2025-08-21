
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Welcome from './components/Welcome';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
    </Routes>
  );
}

export default App;
