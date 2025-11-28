import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Games from './pages/Games';
import Analytics from './pages/Analytics';

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="/analytics" element={<Analytics />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
