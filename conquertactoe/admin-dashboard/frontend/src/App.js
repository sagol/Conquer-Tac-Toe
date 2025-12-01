import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Games from './pages/Games';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import DockerLogs from './pages/DockerLogs';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('adminToken');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                    <PrivateRoute>
                        <Layout>
                            <Dashboard />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/users" element={
                    <PrivateRoute>
                        <Layout>
                            <Users />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/games" element={
                    <PrivateRoute>
                        <Layout>
                            <Games />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/analytics" element={
                    <PrivateRoute>
                        <Layout>
                            <Analytics />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/docker-logs" element={
                    <PrivateRoute>
                        <Layout>
                            <DockerLogs />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/settings" element={
                    <PrivateRoute>
                        <Layout>
                            <Settings />
                        </Layout>
                    </PrivateRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;
