import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LobbyPage from './pages/LobbyPage'
import GameRoom from './pages/GameRoom'

export default function App() {
    return (
        <div className="scanlines">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lobby" element={<LobbyPage />} />
                <Route path="/game/:roomId" element={<GameRoom />} />
            </Routes>
        </div>
    )
}
