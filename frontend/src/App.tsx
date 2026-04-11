import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { VMPage } from './pages/VMPage';
import { SchedulerPage } from './pages/SchedulerPage';

export default function App() {
  return (
    <BrowserRouter>
      {/* Dev Navigation HUD overlay hidden normally but useful if someone connects to root */}
      <Routes>
        <Route path="/" element={
           <div style={{display:'flex', gap:'2rem', padding:'2rem', flexDirection:'column', color:'white'}}>
              <h1>CortexOS Hub</h1>
              <Link to="/vm" style={{color:'#3b82f6', fontSize:'24px'}}>Launch Cortex Simulator (VM)</Link>
              <Link to="/scheduler" style={{color:'#c084fc', fontSize:'24px'}}>Launch Cortex Scheduler</Link>
           </div>
        } />
        <Route path="/vm" element={<VMPage />} />
        <Route path="/scheduler" element={<SchedulerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
