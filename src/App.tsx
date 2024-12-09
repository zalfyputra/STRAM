import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import Logs from './pages/Logs'
import Stats from './pages/Stats'

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