import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LobbyPage from './pages/LobbyPage'
import BoardPage from './pages/BoardPage'

export default function App() {
    return (
        <div className="scanlines">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lobby" element={<LobbyPage />} />
                <Route path="/board/:roomId" element={<BoardPage />} />
                {/* Legacy redirect */}
                <Route path="/game/:roomId" element={<BoardPage />} />
            </Routes>
        </div>
    )
}
