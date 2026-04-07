
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Welcome from './components/Welcome';
import Persona from './components/Persona';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
  <Route path="/welcome" element={<Welcome />} />
  <Route path="/persona" element={<Persona />} />
    </Routes>
  );
}

export default App;
