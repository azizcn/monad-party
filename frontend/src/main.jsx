import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App'
import './index.css'

// ─── Monad Testnet Chain Definition ──────────────────────────────────────────
const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    network: 'monad-testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.monad.xyz'] },
        public: { http: ['https://testnet-rpc.monad.xyz'] },
    },
    blockExplorers: {
        default: { name: 'MonadScan', url: 'https://testnet.monadexplorer.com' },
    },
    testnet: true,
}

// ─── Wagmi Config ─────────────────────────────────────────────────────────────
const config = getDefaultConfig({
    appName: 'Monad Party Game',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'monad-party-game',
    chains: [monadTestnet],
    ssr: false,
})

const queryClient = new QueryClient()

// ─── Root Render ──────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#7c3aed',
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                        fontStack: 'system',
                    })}
                    modalSize="compact"
                >
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>
)
