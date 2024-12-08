import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import Logs from './pages/Logs'

const App = () => {
  return (
    <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
    </Router>
  )
}

export default App