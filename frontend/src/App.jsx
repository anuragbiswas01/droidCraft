import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { DeviceProvider } from './context/DeviceContext';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import MirrorPage from './pages/MirrorPage';
import AppsPage from './pages/AppsPage';
import SystemPage from './pages/SystemPage';
import DeckPage from './pages/DeckPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <DeviceProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/mirror" element={<MirrorPage />} />
              <Route path="/controller" element={<MirrorPage />} />
              <Route path="/apps" element={<AppsPage />} />
              <Route path="/packages" element={<AppsPage />} />
              <Route path="/system" element={<SystemPage />} />
              <Route path="/deck" element={<DeckPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DeviceProvider>
    </ThemeProvider>
  );
}
